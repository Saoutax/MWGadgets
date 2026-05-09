import type { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import { BaseButton } from './BaseButton';
import { Input } from './Input';

/* eslint-disable no-unused-vars */
const InputButton: FunctionalComponent<{
    text: string;
    onAction: (value: string) => void;
}> = ({ text, onAction }) => {
    const [value, setValue] = useState('');

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
            }}
        >
            <div style={{ width: '220px' }}>
                <Input value={value} onInput={setValue} />
            </div>

            <BaseButton text={text} onClick={() => onAction(value)} />
        </div>
    );
};
/* eslint-enable no-unused-vars */

export { InputButton };
