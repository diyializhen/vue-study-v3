## 项目介绍
手写实现可运行的精简版 Vue 3 框架，包括常用核心api和内置组件，带有详细注释。
为了简单明确的展示核心逻辑，代码不包括各种边界条件、环境兼容逻辑、开发环境的提示等。

## 原因
项目目的是用于深入理解 Vue 3 框架的内部机制和核心原理。
通过手写实现核心功能，加深对框架原理和思想的系统理解。同时也作为自己随时回顾复习的资料。

## 已实现
- **响应式API**：
  - reactive、shallowReactive、readonly、shallowReadonly、isProxy
  - ref、shallowRef、isRef、toRef、toRefs
  - computed、watch、watchEffect
- **生命周期钩子**：
  - onBeforeMount、onMounted、onBeforeUpdate、onUpdated、onBeforeUnmount、onUnmounted
  - onActivated、onDeactivated
- **内置组件**：
  - KeepAlive、Teleport、Transition
- **通用API**：
  - nextTick
  - defineAsyncComponent
- **应用实例**：
  - createApp()
  - app.mount()、app.unmount()
- **组件渲染**：
  - props、事件、插槽、setup、render函数、h函数等
- **模板编译**：
  - 模板字符串 -> 模板AST

## 项目结构
```
examples/           # 功能简单展示示例
  components/       # 示例组件
  index.html        # 示例入口文件
  main.js           # 示例入口文件
  router.js         # 示例路由配置
  vueRouter.js      # vue router 简单实现，便于展示实例
src/
  compiler-core/    # 编译器
  reactivity/       # 响应式模块（响应式API）
  runtime-core/     # 运行时核心（组件渲染、虚拟DOM、Diff、内置组件、任务调度）
  runtime-dom/      # DOM运行时（DOM操作方法、属性更新、样式更新）
  shared/           # 工具函数
README.md           # 项目介绍
package.json        # node配置文件
vite.config.js      # vite配置文件
```

## 参考
- Vue 3 源码
- 《Vue.js设计与实现》（霍春阳）

## 快速展示
使用 `pnpm install` 或 `npm install` 安装依赖。
使用 `npm run dev` 启动本地服务，打开功能展示页面。
