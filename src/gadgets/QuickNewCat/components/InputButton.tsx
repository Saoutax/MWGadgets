import { Button, TextInput } from 'ooui-react';
import type { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';

const InputButton: FunctionalComponent<{
    text: string;
    onAction: (value: string) => void | Promise<void>;
}> = ({ text, onAction }) => {
    const [value, setValue] = useState('');

    return (
        <div className="qnc-input-row">
            <div className="qnc-input-wrapper">
                <TextInput type="text" value={value} onChange={setValue} />
            </div>

            <Button
                framed
                flags={['primary', 'progressive']}
                onClick={() => {
                    void onAction(value);
                }}
            >
                {text}
            </Button>
        </div>
    );
};

export { InputButton };
