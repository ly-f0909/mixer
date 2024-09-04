import * as ReactDOM from 'react-dom';
export type Renderer = {
    mount: ReactDOM.Renderer;
    unmount: (container: HTMLElement) => void;
};
type CreateRoot = (container: Element | DocumentFragment) => any;
export declare function getRenderer(props?: {
    createRoot?: CreateRoot;
}): Renderer;
export {};
//# sourceMappingURL=renderer.d.ts.map