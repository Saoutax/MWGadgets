import type { FunctionalComponent } from "preact";

/* eslint-disable no-unused-vars */
const Input: FunctionalComponent<{
    value: string;
    onInput: (value: string) => void;
}> = ({ value, onInput }) => {
    return (
        <div className="oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text">
            <input type="text" value={value} className="oo-ui-inputWidget-input" onInput={e => onInput((e.target as HTMLInputElement).value)} />
        </div>
    );
};
/* eslint-enable no-unused-vars */

export { Input };
