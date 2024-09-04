import * as React from 'react';
import { Customize, Item } from '../types';
export declare const Styles: import("styled-components").StyledComponent<"div", any, {}, never>;
type Props = {
    items: Item[];
    delay: number;
    searchBar?: boolean;
    onHide(): void;
    components?: Customize;
};
export declare function Menu(props: Props): React.JSX.Element;
export {};
//# sourceMappingURL=Menu.d.ts.map