/**
 * `ext.gadget.site-lib` 提供的多语言文案选择函数。
 *
 * 按用户语言在给定的简繁（及其它变体）文案中取值。
 */
declare function wgUXS(
    wg: string,
    hans: string,
    hant?: string,
    cn?: string,
    tw?: string,
    hk?: string,
    sg?: string,
    zh?: string,
    mo?: string,
    my?: string,
): string;

/**
 * 按 `wgUserLanguage` 选择文案。
 *
 * 最常用的是 `wgULS(简体, 繁體)` 这种两参形式。
 *
 * @param hans 简体文案
 * @param hant 繁体文案
 * @returns 当前界面语言对应的文案
 */
declare const wgULS: (
    hans: string,
    hant?: string,
    cn?: string,
    tw?: string,
    hk?: string,
    sg?: string,
    zh?: string,
    mo?: string,
    my?: string,
) => string;

/**
 * 按 `wgUserVariant` 选择文案，参数同 {@link wgULS}。
 */
declare const wgUVS: typeof wgULS;
