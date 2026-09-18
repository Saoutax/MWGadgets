/**
 * OOUI 的 Process.Step 类型只接受 jQuery Promise，但运行时同样支持原生 Promise 与任意 thenable
 * （见 OO.ui.Process 的文档）。此处把 async 步骤一次性收窄为 Step，好过在每个调用点散落断言。
 * @param step 返回原生 Promise 的步骤函数
 */
const asStep = <C>(step: (this: C) => Promise<void>): OO.ui.Process.Step<C> => {
    return step as unknown as OO.ui.Process.Step<C>;
};

export { asStep };
