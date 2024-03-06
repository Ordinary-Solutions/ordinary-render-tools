export type TVector4 = [number, number, number, number];
export type TVector3 = [number, number, number];
export type TVector2 = [number, number];

export interface IGeometryData {
    shaderIndex: number;
    vertices: Float32Array;
    uvs: Float32Array[];
    tangent: Float32Array | undefined;
    normals: Float32Array | undefined
    indices: number[];
}