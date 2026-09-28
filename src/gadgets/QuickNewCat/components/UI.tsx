import { Button, PanelLayout } from 'ooui-react';
import type { FunctionalComponent } from 'preact';
import { work, character, music, vup, charainwork, real, author } from '../modules/create';
import { InputButton } from './InputButton';

const UI: FunctionalComponent = () => (
    <PanelLayout padded framed className="qnc-container" style={{ width: 'auto' }}>
        <span className="qnc-title">快速创建分类页</span>
        <div className="qnc-actions">
            <Button framed flags={['primary', 'progressive']} onClick={work}>
                {'{{作品}}'}
            </Button>
            <Button framed flags={['primary', 'progressive']} onClick={character}>
                {'{{作品中角色}}'}
            </Button>
            <Button framed flags={['primary', 'progressive']} onClick={music}>
                {'{{作品中音乐}}'}
            </Button>
            <Button framed flags={['primary', 'progressive']} onClick={vup}>
                {'{{虚拟角色/虚拟UP主}}'}
            </Button>
            <InputButton text="{{虚拟角色/作}}" onAction={charainwork} />
            <InputButton text="{{现实人物}}" onAction={real} />
            <InputButton text="{{作者分类}}" onAction={author} />
        </div>
    </PanelLayout>
);

export { UI };
