import type {
    ICodewalkerTextureDictionaryItem
} from "~/assets/ts/codewalker/interfaces/ICodewalkerTextureDictionaryItem";
import type { ICodewalkerShader } from "~/assets/ts/codewalker/interfaces/ICodewalkerShader";

export interface IShaderGroup {
    textureDictionary: ICodewalkerTextureDictionaryItem[] | null;
    shaders: ICodewalkerShader[];
}