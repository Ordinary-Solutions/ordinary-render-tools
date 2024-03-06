export interface ICodewalkerShader {
    name: string | undefined;
    parameters?: ICodewalkerShaderParameters | undefined;
}

export interface ICodewalkerShaderParameters {
    DiffuseSampler?: string; // texture
    BumpSampler?: string; // normal map
    SpecSampler?: string; // specular map
    VolumeSampler?: string;
}
