import type { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import { BaseButton } from './BaseButton';

const InputButton: FunctionalComponent<{
    text: string;
    onAction: (value: string) => void;
}> = ({ text, onAction }) => {
    const [value, setValue] = useState('');

    return (
        <div className="qnc-input-row">
            <div className="qnc-input-wrapper">
                <div className="oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text">
                    <input
                        type="text"
                        value={value}
                        onInput={e => setValue((e.target as HTMLInputElement).value)}
                        className="oo-ui-inputWidget-input"
                    />
                </div>
            </div>

            <BaseButton text={text} onClick={() => onAction(value)} />
        </div>
    );
};

export { InputButton };
