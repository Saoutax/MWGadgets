/**
 * DisamAssist 的 MediaWiki gadget 入口。
 *
 * 等待 jQuery/DOM ready 后再交给 `install`，由 install 负责判断页面并加载所需 MediaWiki 模块。
 */
import { install } from './modules/install';

// deps: mediawiki.Title mediawiki.api mediawiki.util
$(() => install());
