import { Structure } from "molstar/lib/mol-model/structure";
import { ImageRenderer } from "../render";

export interface FocusFactoryI {
    getFocus(imageRender: ImageRenderer):(structure: Structure)=>void;
}

