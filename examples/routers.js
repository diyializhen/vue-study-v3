import Introduction from "./components/Introduction.js"
import LifeCycle from "./components/LifeCycle.js"
import Compiler from "./components/compiler.js"
import ReactivityData from "./components/ReactivityData.js"
import WatchTest from "./components/WatchTest.js"
import ComputedTest from "./components/ComputedTest.js"
import NextTickTest from "./components/NextTickTest.js"
import TeleportTest from "./components/TeleportTest.js"
import KeepAliveTest from "./components/KeepAliveTest.js"
import TransitionTest from "./components/TransitionTest.js"
import AsyncComponentTest from "./components/AsyncComponentTest.js"

// 路由
export default [
  {
    path: '/',
    name: 'Introduction',
    component: Introduction,
    meta: { title: '介绍' }
  },
  {
    path: '/LifeCycle',
    name: 'LifeCycle',
    component: LifeCycle,
    meta: { title: '生命周期' }
  },
  {
    path: '/ReactivityData',
    name: 'ReactivityData',
    component: ReactivityData,
    meta: { title: '响应式数据' }
  },
  {
    path: '/WatchTest',
    name: 'WatchTest',
    component: WatchTest,
    meta: { title: 'watch测试' }
  },
  {
    path: '/ComputedTest',
    name: 'ComputedTest',
    component: ComputedTest,
    meta: { title: 'computed测试' }
  },
  {
    path: '/NextTickTest',
    name: 'NextTickTest',
    component: NextTickTest,
    meta: { title: 'nextTick测试' }
  },
  {
    path: '/TeleportTest',
    name: 'TeleportTest',
    component: TeleportTest,
    meta: { title: 'Teleport测试' }
  },
  {
    path: '/KeepAliveTest',
    name: 'KeepAliveTest',
    component: KeepAliveTest,
    meta: { title: 'KeepAlive测试' }
  },
  {
    path: '/TransitionTest',
    name: 'TransitionTest',
    component: TransitionTest,
    meta: { title: 'Transition测试' }
  },
  {
    path: '/AsyncComponentTest',
    name: 'AsyncComponentTest',
    component: AsyncComponentTest,
    meta: { title: 'defineAsyncComponent测试' }
  },
  {
    path: '/Compiler',
    name: 'Compiler',
    component: Compiler,
    meta: { title: '模板编译' }
  },
]
