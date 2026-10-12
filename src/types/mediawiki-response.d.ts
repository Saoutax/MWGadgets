/**
 * types-mediawiki-response 的站点补充层。
 *
 * 官方包只覆盖 MediaWiki 核心的 action 与 query 字段，站点私有 action 与包未收录的字段
 * 都在这里按官方接缝补齐，供全项目直接使用。
 *
 * 本仓库未调用任何扩展 action（thanks / discussiontools / wikilove 等），也未消费扩展的
 * query 字段，故此处不激活任何扩展包；需要时加一行
 * `import type {} from 'types-mediawiki-response/ext/<pack>';` 即可全局增广。
 */
import type { ApiBcErrorResponse, ApiEnvelope, ApiModernErrorResponse } from 'types-mediawiki-response';

declare global {
    /** 萌百私有 action=moedisplayname 的一条昵称记录。 */
    interface MoegirlDisplayNameEntry {
        /** 用户 id。 */
        userid: number;
        /** 用户昵称（显示名）。 */
        displayname?: string;
    }

    /** 萌百私有 action=moedisplayname 的响应；types-mediawiki-response 未覆盖该 action。 */
    interface MoegirlDisplayNameResponse extends ApiEnvelope {
        /** 昵称查询结果，未命中时为空数组或缺省。 */
        displaynames?: MoegirlDisplayNameEntry[];
    }

    /**
     * mw.Api 多参 reject 的第二个参数，即失败时的响应体。
     *
     * 站点未统一设置 errorformat，故 bc（顶层 error 单对象）与 modern（顶层 errors 数组）
     * 两种信封都要容忍。
     */
    type ApiRejectPayload = ApiBcErrorResponse | ApiModernErrorResponse;

    /**
     * 防滥用过滤器以警告模式拦下编辑时出现的过滤器信息。
     *
     * 字段以现网 action=edit 的响应为准；过滤器编号可能是数字或字符串。
     */
    interface AbusefilterWarning {
        /** 过滤器编号。 */
        id: number | string;
        /** 过滤器说明，直接拼进提示文案。 */
        description: string;
        /** 触发的动作列表，含 warn 才是警告模式。 */
        actions: string[];
    }
}

declare module 'types-mediawiki-response' {
    interface ApiEditResult {
        /**
         * 被防滥用过滤器以警告模式拦下时出现（同时 result 为 Failure）。
         * types-mediawiki-response 未收录该字段，这里按现网响应补上。
         */
        abusefilter?: AbusefilterWarning;
    }
}
