import Introduction from "./components/Introduction.js"
import LifeCycle from "./components/LifeCycle.js"
import Compiler from "./components/compiler.js"
import ReactivityData from "./components/ReactivityData.js"
import WatchTest from "./components/WatchTest.js"
import ComputedTest from "./components/ComputedTest.js"

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
    meta: { title: 'watch' }
  },
  {
    path: '/ComputedTest',
    name: 'ComputedTest',
    component: ComputedTest,
    meta: { title: 'computed' }
  },
  {
    path: '/Compiler',
    name: 'Compiler',
    component: Compiler,
    meta: { title: '模板编译' }
  },
]
