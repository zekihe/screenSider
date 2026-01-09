import React, { lazy, Suspense } from 'react'
import { createHashRouter } from 'react-router-dom'

// 异步加载页面组件
import Home from '../pages/Home'
// const Home = () => lazy(() => import('../pages/Home'));
import Error from '../pages/Error'
// const Error = () => lazy(() => import('../pages/Error'));
const CameraOverlay = lazy(() => import('../pages/CameraOverlay'))
const ScreenSelector = lazy(() => import('../pages/ScreenSelector'))
const Settings = lazy(() => import('../pages/Settings'))

// 加载组件
const Loading = () => <div>Loading...</div>

// 创建路由配置
const router = createHashRouter([
    {
        path: '/',
        element: <Home />
    },
    {
        path: '/error',
        element: <Error />
    },
    {
        path: '/camera-overlay',
        element: (
            <Suspense fallback={<Loading />}>
                <CameraOverlay />
            </Suspense>
        )
    },
    {
        path: '/screen-selector',
        element: (
            <Suspense fallback={<Loading />}>
                <ScreenSelector />
            </Suspense>
        )
    },
    {
        path: '/settings',
        element: (
            <Suspense fallback={<Loading />}>
                <Settings />
            </Suspense>
        )
    }
])

export default router
