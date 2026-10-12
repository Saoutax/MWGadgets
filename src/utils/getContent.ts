import type { ApiQueryResponse, QueryPage } from 'types-mediawiki-response';
import { apiPost } from './api';

const { wgPageName } = mw.config.get();

/**
 * 获取页面内容
 *
 * @param titles 页面标题，默认为当前页面
 * @returns 页面内容；页面不存在时为空字符串
 */
const getContent = async (titles = wgPageName): Promise<string> => {
    const res = await apiPost<ApiQueryResponse>({
        action: 'query',
        titles,
        prop: 'revisions',
        rvprop: 'content',
    });
    const pages = (res.query.pages ?? []) as QueryPage<'revisions'>[];
    return pages[0]?.revisions?.[0]?.content ?? '';
};

export { getContent };
