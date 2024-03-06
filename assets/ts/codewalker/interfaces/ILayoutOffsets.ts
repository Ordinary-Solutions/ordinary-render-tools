export interface ILayoutOffsets {
    [index: string]: number | undefined;

    Position?: number; // Vector3
    BlendWeights?: number; // Color4
    BlendIndices?: number; // Color4
    Normal?: number; // Vector3
    Colour0?: number; // Color4
    Colour1?: number; // Color4
    TexCoord0?: number; // Vector2
    Tangent?: number; // Vector4
}