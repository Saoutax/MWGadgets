import { Button, PanelLayout } from 'ooui-react';
import type { FunctionalComponent } from 'preact';
import { work, character, music, vup, charainwork, real, author } from '../modules/create';
import { InputButton } from './InputButton';

const UI: FunctionalComponent = () => (
    // 原版 OOUI 的 expanded 默认开启，会给面板加 oo-ui-panelLayout-expanded（absolute 铺满父容器）；
    // 旧版手写标记没有该类，这里显式关掉以保持原有文档流布局
    <PanelLayout padded framed expanded={false} className="qnc-container" style={{ width: 'auto' }}>
        <span className="qnc-title">快速创建分类页</span>
        <div className="qnc-actions">
            <Button
                framed
                flags={['primary', 'progressive']}
                onClick={() => {
                    void work();
                }}
            >
                {'{{作品}}'}
            </Button>
            <Button
                framed
                flags={['primary', 'progressive']}
                onClick={() => {
                    void character();
                }}
            >
                {'{{作品中角色}}'}
            </Button>
            <Button
                framed
                flags={['primary', 'progressive']}
                onClick={() => {
                    void music();
                }}
            >
                {'{{作品中音乐}}'}
            </Button>
            <Button
                framed
                flags={['primary', 'progressive']}
                onClick={() => {
                    void vup();
                }}
            >
                {'{{虚拟角色/虚拟UP主}}'}
            </Button>
            <InputButton text="{{虚拟角色/作}}" onAction={charainwork} />
            <InputButton text="{{现实人物}}" onAction={real} />
            <InputButton text="{{作者分类}}" onAction={author} />
        </div>
    </PanelLayout>
);

export { UI };
