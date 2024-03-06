import type { IGeometryData } from "~/assets/ts/codewalker/interfaces/IGeometryData";
import type { IShaderGroup } from "~/assets/ts/codewalker/interfaces/IShaderGroup";

export interface ICodewalkerYdd {
    drawableName: string;

    geometries: IGeometryData[];

    shaderGroup: IShaderGroup;
}