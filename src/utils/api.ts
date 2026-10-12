/** mw.Api 的请求参数类型：取自被包装方法的形参，避免直接依赖间接依赖 types-mediawiki-api。 */
type ApiParams = Parameters<mw.Api['post']>[0];

/** 包装后的请求 promise：成功值是 T，第二个成功参数是 jqXHR，reject 参数与 mw.Api 一致。 */
type ApiPromise<T> = mw.Api.AbortablePromise<[T, JQuery.jqXHR<T>]>;

/** 惰性创建的共享 mw.Api 实例：部分 gadget 需等 mediawiki.api 模块加载完成后才能构造它。 */
let defaultApi: mw.Api | undefined;

/**
 * 取本次请求使用的 API 实例。
 *
 * @param instance 显式指定的实例（如共享站的 mw.ForeignApi）；缺省用共享实例
 * @returns 实际使用的 API 实例
 */
const resolveApi = (instance?: mw.Api): mw.Api => instance ?? (defaultApi ??= new mw.Api());

/**
 * 把 mw.Api 的宽响应 promise 收敛为带响应类型的 promise。
 *
 * mw.Api#get / post 的解析值是 Record<string, any> 且没有响应类型泛型，调用点无法直接声明
 * 响应类型；故包装层在此做全项目唯一一次断言，调用点只负责给出泛型实参。
 *
 * @param promise mw.Api 返回的 promise
 * @returns 成功值类型为 T、其余参数不变的那个 promise
 */
const typed = <T>(promise: mw.Api.AbortablePromise): ApiPromise<T> => promise as unknown as ApiPromise<T>;

/**
 * 发送 GET 请求。
 *
 * 成功时 resolve 的即为调用点声明的响应类型；失败时仍以 mw.Api 的多参形式
 * reject，即 `.catch` / `.fail` 的第一个参数是错误码、第二个参数是错误载荷。
 *
 * @param params 请求参数；`formatversion: 2` 由本函数默认注入，显式传入可覆盖
 * @param instance 使用的 API 实例；缺省用共享实例
 * @returns 成功值为 T 的 promise
 */
const apiGet = <T>(params: ApiParams, instance?: mw.Api): ApiPromise<T> =>
    typed<T>(resolveApi(instance).get({ formatversion: 2, ...params }));

/**
 * 发送 POST 请求。
 *
 * 成功时 resolve 的即为调用点声明的响应类型；失败时仍以 mw.Api 的多参形式
 * reject，即 `.catch` / `.fail` 的第一个参数是错误码、第二个参数是错误载荷。
 *
 * @param params 请求参数；`formatversion: 2` 由本函数默认注入，显式传入可覆盖
 * @param instance 使用的 API 实例；缺省用共享实例
 * @returns 成功值为 T 的 promise
 */
const apiPost = <T>(params: ApiParams, instance?: mw.Api): ApiPromise<T> =>
    typed<T>(resolveApi(instance).post({ formatversion: 2, ...params }));

/**
 * 带 CSRF 等令牌发送 POST 请求。
 *
 * 成功时 resolve 的即为调用点声明的响应类型；失败时仍以 mw.Api 的多参形式
 * reject，即 `.catch` / `.fail` 的第一个参数是错误码、第二个参数是错误载荷。
 *
 * @param tokenType 令牌类型，如 `csrf`
 * @param params 请求参数；`formatversion: 2` 由本函数默认注入，显式传入可覆盖
 * @param instance 使用的 API 实例；缺省用共享实例
 * @returns 成功值为 T 的 promise
 */
const apiPostWithToken = <T>(tokenType: string, params: ApiParams, instance?: mw.Api): ApiPromise<T> =>
    typed<T>(resolveApi(instance).postWithToken(tokenType, { formatversion: 2, ...params }));

export { apiGet, apiPost, apiPostWithToken };
