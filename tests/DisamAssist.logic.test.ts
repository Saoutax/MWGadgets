import assert from 'node:assert/strict';
import {
    contextAround,
    findWikiLink,
    mergeUniqueTitles,
    parseDisambiguationTargets,
    removeWikiLink,
    replaceWikiLink,
} from '../src/gadgets/DisamAssist/modules/wiki';
import { buildEditSummary } from '../src/gadgets/DisamAssist/modules/summary';
import type { ActionRecord } from '../src/gadgets/DisamAssist/modules/types';

const normalizer = (title: string) => title.replaceAll('_', ' ').trim();
const targets = new Set(['目标页', '目标别名']);

const link = findWikiLink('前文 [[目标别名|显示文本]] 后文', targets, 0, normalizer);
assert.ok(link);
assert.equal(link.title, '目标别名');
assert.equal(link.displayText, '显示文本');
assert.equal(
    replaceWikiLink('前文 [[目标别名|显示文本]] 后文', link, '目标页', normalizer),
    '前文 [[目标页|显示文本]] 后文',
);
assert.equal(removeWikiLink('前文 [[目标别名|显示文本]] 后文', link), '前文 显示文本 后文');
const contextLink = findWikiLink('前文 [[目标页]] 后文', targets, 0, normalizer);
assert.ok(contextLink);
assert.deepEqual(contextAround('前文 [[目标页]] 后文', contextLink), [
    '前文 ',
    '[[目标页]]',
    ' 后文',
]);
assert.equal(findWikiLink('[[不存在]]', targets, 0, normalizer), null);
assert.equal(
    replaceWikiLink('[[目标页#章节]]', { ...contextLink, end: 10, start: 0, title: '目标页#章节' }, '新条目', normalizer),
    '[[新条目#章节|目标页]]',
);

assert.deepEqual(
    parseDisambiguationTargets('[[目标页]]——说明\n{{dis|目标别名|说明}}\n[[File:忽略.png]]', normalizer),
    ['目标页', '目标别名'],
);
assert.equal(parseDisambiguationTargets('[[目标页]]——说明', normalizer).includes('说明'), false);
assert.deepEqual(mergeUniqueTitles(['A', 'B', 'A']), ['A', 'B']);

const action = (kind: ActionRecord['kind'], summary: string): ActionRecord => ({
    contentBefore: '',
    kind,
    link: { displayText: '目标页', end: 8, start: 0, target: '目标页', title: '目标页' },
    pageTitle: '页面',
    summary,
});
assert.equal(buildEditSummary('目标页', [action('remove', '移除链接')]), 'DisamAssist：移除链接：[[目标页]]');
assert.equal(
    buildEditSummary('目标页', [action('replace', '实际条目'), action('replace', '另一个条目')]),
    'DisamAssist：[[目标页]] → 实际条目；另一个条目',
);

console.log('DisamAssist logic tests passed.');
