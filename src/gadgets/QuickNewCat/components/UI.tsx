import type { FunctionalComponent } from 'preact';
import { work, character, music, vup, charainwork, real, author } from '../modules/create';
import { BaseButton } from './BaseButton';
import { InputButton } from './InputButton';

const UI: FunctionalComponent = () => (
    <div className="oo-ui-layout oo-ui-panelLayout oo-ui-panelLayout-padded oo-ui-panelLayout-framed qnc-container">
        <span className="qnc-title">快速创建分类页</span>
        <div className="qnc-actions">
            <BaseButton text="{{作品}}" onClick={work} />
            <BaseButton text="{{作品中角色}}" onClick={character} />
            <BaseButton text="{{作品中音乐}}" onClick={music} />
            <BaseButton text="{{虚拟角色/虚拟UP主}}" onClick={vup} />
            <InputButton text="{{虚拟角色/作}}" onAction={charainwork} />
            <InputButton text="{{现实人物}}" onAction={real} />
            <InputButton text="{{作者分类}}" onAction={author} />
        </div>
    </div>
);

export { UI };
