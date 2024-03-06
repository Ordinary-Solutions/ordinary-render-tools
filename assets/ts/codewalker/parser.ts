import type { ICodewalkerYdd } from "~/assets/ts/codewalker/interfaces/ICodewalkerYdd";
import { EDrawableModelQuality } from "~/assets/ts/codewalker/enums/EDrawableModelQuality";
import type { ILayoutOffsets } from "~/assets/ts/codewalker/interfaces/ILayoutOffsets";
import type { IGeometryData, TVector4 } from "~/assets/ts/codewalker/interfaces/IGeometryData";
import type {
    ICodewalkerTextureDictionaryItem
} from "~/assets/ts/codewalker/interfaces/ICodewalkerTextureDictionaryItem";
import type {
    ICodewalkerShader,
    ICodewalkerShaderParameters
} from "~/assets/ts/codewalker/interfaces/ICodewalkerShader";
import type { IShaderGroup } from "~/assets/ts/codewalker/interfaces/IShaderGroup";

export function parseCodewalkerYdd(xmlContent: string): ICodewalkerYdd {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    if (xmlDoc.querySelector('parsererror')) {
        throw new Error("codewalker -> parser -> parseCodewalkerYdd -> Invalid XML");
    }

    let drawableName = _getDrawableName(xmlDoc);

    let drawableModelItemsXml = _getDrawableModelItems(xmlDoc);
    let shadersGroupEl = xmlDoc.querySelector("ShaderGroup");

    if (!shadersGroupEl) {
        throw new Error("codewalker -> parser -> parseCodewalkerYdd -> ShaderGroup not found");
    }

    if (drawableModelItemsXml.length === 0) {
        throw new Error("codewalker -> parser -> parseCodewalkerYdd -> DrawableModelItems not found");
    }

    let geometries = _getGeometriesData(xmlDoc);
    let shaderGroup = _getShaderGroupData(xmlDoc);

    return {
        drawableName,
        geometries,
        shaderGroup,
    };
}

function _getGeometriesData(drawableModel: Document) {
    let geometryItems = drawableModel.querySelector("Geometries");

    if (!geometryItems) {
        throw new Error("codewalker -> parser -> _getGeometriesData -> Geometries not found");
    }

    let geometries: IGeometryData[] = [];

    for (let geometry of geometryItems.querySelectorAll('Item')) {
        geometries.push(_getGeometryItemData(geometry));
    }

    return geometries;
}

function _getLayoutOffsets(geometry: Element) {
    let layoutOffsets = geometry.querySelector("VertexBuffer > Layout");

    if (!layoutOffsets) {
        throw new Error("codewalker -> parser -> _getLayoutOffsets -> LayoutOffsets not found");
    }

    const layoutOffsetShift: Required<ILayoutOffsets> = {
        Position: 3, // Vector3
        BlendWeights: 4, // Color4
        BlendIndices: 4, // Color4
        Normal: 3, // Vector3
        Colour0: 4, // Color4
        Colour1: 4, // Color4
        TexCoord0: 2, // Vector2
        TexCoord1: 2, // Vector2
        TexCoord2: 2, // Vector2
        TexCoord3: 2, // Vector2
        TexCoord4: 2, // Vector2
        Tangent: 4, // Vector4
    };

    let offsets: ILayoutOffsets = {};

    let currentOffset = 0;

    for (let child of layoutOffsets.children) {
        if (layoutOffsetShift.hasOwnProperty(child.tagName)) {
            offsets[child.tagName] = currentOffset;

            // @ts-ignore
            currentOffset += layoutOffsetShift[child.tagName];
        } else {
            throw new Error(`codewalker -> parser -> _getLayoutOffsets -> Unknown layout offset: ${child.tagName}`);
        }
    }

    return offsets;
}

function _getShaderGroupData(xmlDoc: Document): IShaderGroup {
    let shaderGroupEl = xmlDoc.querySelector("ShaderGroup");

    let textureDictionary = null;

    if (!shaderGroupEl) {
        throw new Error("codewalker -> parser -> _getShadersData -> ShaderGroup not found");
    }

    let textureDictionaryEl = shaderGroupEl.querySelector("TextureDictionary");

    if (textureDictionaryEl) {
        textureDictionary = _getTextureDictionaryData(textureDictionaryEl);
    }

    let shadersEl = shaderGroupEl.querySelector("Shaders");

    if (!shadersEl) {
        throw new Error("codewalker -> parser -> _getShadersData -> Shaders not found");
    }

    let shaders = _getShadersData(shadersEl);

    return {
        textureDictionary,
        shaders,
    };
}

function _getShaderParametersData(shaderParametersEl: Element): ICodewalkerShaderParameters {
    return {
        DiffuseSampler: shaderParametersEl.querySelector("Item[name=DiffuseSampler] > Name")?.innerHTML,
        BumpSampler: shaderParametersEl.querySelector("Item[name=BumpSampler] > Name")?.innerHTML,
        SpecSampler: shaderParametersEl.querySelector("Item[name=SpecSampler] > Name")?.innerHTML,
        VolumeSampler: shaderParametersEl.querySelector("Item[name=VolumeSampler] > Name")?.innerHTML,
    };
}

function _getShadersData(shaderXml: Element) {
    let shaders: ICodewalkerShader[] = [];

    for (let shaderElement of shaderXml.querySelectorAll("& > Item")) {
        let shader: ICodewalkerShader = {
            name: shaderElement.querySelector("Name")?.innerHTML,
        };

        let parametersEl = shaderElement.querySelector("& > Parameters");

        if (parametersEl) {
            shader.parameters = _getShaderParametersData(parametersEl);
        }

        shaders.push(shader);
    }

    return shaders;
}

function _getTextureDictionaryData(textureDictionaryXml: Element) {
    let textureDictionary: ICodewalkerTextureDictionaryItem[] = [];

    for (let item of textureDictionaryXml.querySelectorAll("Item")) {
        textureDictionary.push({
            name: item.querySelector("Name")?.innerHTML,
            usage: item.querySelector("Texture")?.innerHTML,
            format: item.querySelector("Texture")?.innerHTML,
            filename: item.querySelector("FileName")?.innerHTML,
        });
    }

    return textureDictionary;
}

function _getGeometryItemData(geometry: Element): IGeometryData {
    console.time('parseGeometryData');

    let shaderIndex = Number(geometry.querySelector('ShaderIndex')?.innerHTML);
    let layoutOffsets = _getLayoutOffsets(geometry);

    if (layoutOffsets.Position === undefined || layoutOffsets.TexCoord0 === undefined) {
        throw new Error("codewalker -> parser -> _getGeometryItemData -> Required layout offsets not found");
    }

    let vertexBufferElement = geometry.querySelector("VertexBuffer > Data");

    if (!vertexBufferElement) {
        vertexBufferElement = geometry.querySelector("VertexBuffer > Data2");

        if (!vertexBufferElement) {
            throw new Error("codewalker -> parser -> _getGeometryItemData -> GeometryBuffer not found");
        }
    }

    let vertexBufferRaw = vertexBufferElement.innerHTML;
    // remove double spaces
    vertexBufferRaw = vertexBufferRaw.replace(/ +(?= )/g, '');

    let vertexBufferLines = vertexBufferRaw.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    let vertexBuffer = vertexBufferLines.map(line => line.split(' ').map(Number));

    let geometryData: IGeometryData = {
        shaderIndex: shaderIndex,
        vertices: new Float32Array(vertexBuffer.length * 3),
        uvs: [
            new Float32Array(vertexBuffer.length * 2)
        ],
        tangent: new Float32Array(vertexBuffer.length * 4),
        normals: layoutOffsets.Normal !== undefined ? new Float32Array(vertexBuffer.length * 3) : undefined,
        indices: [],
    };

    if (layoutOffsets.TexCoord1 !== undefined) {
        geometryData.uvs.push(new Float32Array(vertexBuffer.length * 2));
    }

    if (layoutOffsets.TexCoord2 !== undefined) {
        geometryData.uvs.push(new Float32Array(vertexBuffer.length * 2));
    }

    if (layoutOffsets.TexCoord3 !== undefined) {
        geometryData.uvs.push(new Float32Array(vertexBuffer.length * 2));
    }

    if (layoutOffsets.TexCoord4 !== undefined) {
        geometryData.uvs.push(new Float32Array(vertexBuffer.length * 2));
    }

    for (let i = 0; i < vertexBuffer.length; i++) {
        let buffer = vertexBuffer[i];

        let vertex = buffer.slice(layoutOffsets.Position, layoutOffsets.Position + 3);
        let uvs = buffer.slice(layoutOffsets.TexCoord0, layoutOffsets.TexCoord0 + 2);

        geometryData.vertices.set(vertex, i * 3);
        geometryData.uvs[0].set(uvs, i * 2);

        if (layoutOffsets.Normal !== undefined) {
            let normals = buffer.slice(layoutOffsets.Normal, layoutOffsets.Normal + 3);

            geometryData.normals!.set(normals, i * 3);
        }

        if (layoutOffsets.Tangent !== undefined) {
            let tangent = buffer.slice(layoutOffsets.Tangent, layoutOffsets.Tangent + 4);

            // sometimes codewalker produces NaN values for tangents. We need to filter them out
            tangent = tangent.filter((value) => isNaN(value) === false);

            // if data is valid (4 values) then set it
            if (tangent.length === 4) {
                geometryData.tangent!.set(tangent, i * 4);
            }
        }

        // if (layoutOffsets.TexCoord1) {
        //     geometryData[1].set(buffer.slice(layoutOffsets.TexCoord1, layoutOffsets.TexCoord1 + 2), i * 2);
        // }

        // if (layoutOffsets.Colour0) {
        //     let color = buffer.slice(layoutOffsets.Colour0, layoutOffsets.Colour0 + 4);
        //     colors.push(color);
        // }
    }

    let indexBufferElement = geometry.querySelector("IndexBuffer > Data");

    if (!indexBufferElement) {
        indexBufferElement = geometry.querySelector("IndexBuffer > Data2");

        if (!indexBufferElement) {
            throw new Error("codewalker -> parser -> _getGeometryItemData -> IndexBuffer not found");
        }
    }

    let indexBufferRaw = indexBufferElement.innerHTML;
    // remove double spaces and line breaks
    indexBufferRaw = indexBufferRaw
        .replace(/ +(?= )/g, '')
        .replace(/\n/g, '')
        .trim();

    let indexBuffer = indexBufferRaw.split(' ')
        .map(Number);

    // if (vertexBuffer.length * 3 !== indexBuffer.length) {
    //     console.warn("codewalker -> parser -> _getGeometryItemData -> Vertex and Index buffer length mismatch");
    // }

    geometryData.indices = indexBuffer;

    console.timeEnd('parseGeometryData');

    return geometryData;
}

function _getDrawableModelItems(xmlDoc: Document, quality: EDrawableModelQuality = EDrawableModelQuality.HIGH) {
    let tagName: string;

    if (quality === EDrawableModelQuality.HIGH) {
        tagName = "DrawableModelsHigh";
    } else {
        throw new Error('codewalker -> parser -> _getDrawableModelItems -> Quality selection not implemented');
    }

    let drawableModels = xmlDoc.querySelector(tagName);

    if (!drawableModels) {
        throw new Error("codewalker -> parser -> _getDrawableModelItems -> DrawableModels with this quality not found");
    }

    return drawableModels.querySelectorAll("Item");
}

function _getDrawableName(xmlDoc: Document) {
    let item = xmlDoc.querySelector("Item");

    if (!item) {
        throw new Error("codewalker -> parser -> _getDrawableName -> Item not found");
    }

    let nameElement = item.querySelector("Name");

    if (!nameElement) {
        throw new Error("codewalker -> parser -> _getDrawableName -> Name not found");
    }

    return nameElement.innerHTML;
}
