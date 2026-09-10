import { describe, expect, it } from 'vitest';
import { buildEditSummary } from '../src/gadgets/DisamAssist/modules/summary';
import type { ActionRecord } from '../src/gadgets/DisamAssist/modules/types';
import {
    contextAround,
    findWikiLink,
    mergeUniqueTitles,
    parseDisambiguationTargets,
    removeWikiLink,
    replaceWikiLink,
} from '../src/gadgets/DisamAssist/modules/wiki';

const normalizer = (title: string) => title.replaceAll('_', ' ').trim();
const targets = new Set(['目标页', '目标别名']);

describe('wiki helpers', () => {
    it('finds a matching link and extracts its display text', () => {
        const link = findWikiLink('前文 [[目标别名|显示文本]] 后文', targets, 0, normalizer);

        expect(link).toEqual(
            expect.objectContaining({
                title: '目标别名',
                displayText: '显示文本',
            }),
        );
    });

    it('replaces a matching link while preserving its display text', () => {
        const link = findWikiLink('前文 [[目标别名|显示文本]] 后文', targets, 0, normalizer);

        expect(link).not.toBeNull();
        expect(replaceWikiLink('前文 [[目标别名|显示文本]] 后文', link!, '目标页', normalizer)).toBe(
            '前文 [[目标页|显示文本]] 后文',
        );
    });

    it('removes a link while keeping its display text', () => {
        const link = findWikiLink('前文 [[目标别名|显示文本]] 后文', targets, 0, normalizer);

        expect(link).not.toBeNull();
        expect(removeWikiLink('前文 [[目标别名|显示文本]] 后文', link!)).toBe('前文 显示文本 后文');
    });

    it('returns the text around a matching link', () => {
        const text = '前文 [[目标页]] 后文';
        const link = findWikiLink(text, targets, 0, normalizer);

        expect(link).not.toBeNull();
        expect(contextAround(text, link!)).toEqual(['前文 ', '[[目标页]]', ' 后文']);
    });

    it('returns null when no target link is found', () => {
        expect(findWikiLink('[[不存在]]', targets, 0, normalizer)).toBeNull();
    });

    it('preserves a fragment as display text when replacing a link', () => {
        const link = findWikiLink('前文 [[目标页]] 后文', targets, 0, normalizer);

        expect(link).not.toBeNull();
        expect(
            replaceWikiLink(
                '[[目标页#章节]]',
                { ...link!, end: 10, start: 0, title: '目标页#章节' },
                '新条目',
                normalizer,
            ),
        ).toBe('[[新条目#章节|目标页]]');
    });

    it('parses unique targets from disambiguation content', () => {
        expect(
            parseDisambiguationTargets('[[目标页]]——说明\n{{dis|目标别名|说明}}\n[[File:忽略.png]]', normalizer),
        ).toEqual(['目标页', '目标别名']);
    });

    it('does not include explanatory text as a target', () => {
        expect(parseDisambiguationTargets('[[目标页]]——说明', normalizer)).not.toContain('说明');
    });

    it('merges titles without duplicates', () => {
        expect(mergeUniqueTitles(['A', 'B', 'A'])).toEqual(['A', 'B']);
    });
});

describe('buildEditSummary', () => {
    const action = (kind: ActionRecord['kind'], summary: string): ActionRecord => ({
        contentBefore: '',
        kind,
        link: { displayText: '目标页', end: 8, start: 0, target: '目标页', title: '目标页' },
        pageTitle: '页面',
        summary,
    });

    it('summarizes link removal', () => {
        expect(buildEditSummary('目标页', [action('remove', '移除链接')])).toBe('DisamAssist：移除链接：[[目标页]]');
    });

    it('summarizes distinct replacements', () => {
        expect(buildEditSummary('目标页', [action('replace', '实际条目'), action('replace', '另一个条目')])).toBe(
            'DisamAssist：[[目标页]] → 实际条目；另一个条目',
        );
    });
});
