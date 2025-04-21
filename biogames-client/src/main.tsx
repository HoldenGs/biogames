import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Root from './Root.tsx';
import GamePage from './GamePage.tsx';
import Menu from './Menu.tsx';
import ResultsPage from './ResultsPage.tsx';
import IntroductionPage from './IntroductionPage.tsx';
import TestRegisterForm from './TestRegisterForm.tsx';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools/build/lib/devtools';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            networkMode: "always"
        }
    }
});


const router = createHashRouter([
    {
        path: '/',
        element: <Root/>,
        children: [
            {
                index: true,
                element: <Navigate to="/menu" replace />
            },
            {
                path: 'introduction',
                element: <IntroductionPage />
            },
            {
                path: 'menu',
                element: <Menu mode="training" />
            },
            {
                path: 'game',
                element: <GamePage mode="training" />
            },
            {
                path: 'games/:id/results',
                element: <ResultsPage mode="training" />
            },
        ]
    },
    {
        path: '/pretest',
        element: <Root/>,
        children: [
            {
                index: true,
                element: <Navigate to="/pretest/menu" replace />
            },
            {
                path: 'menu',
                element: <Menu mode="pretest" />
            },
            {
                path: 'game',
                element: <GamePage mode="pretest" />
            },
            {
                path: 'games/:id/results',
                element: <ResultsPage mode="pretest" />
            },
        ]
    },
    {
        path: '/posttest',
        element: <Root/>,
        children: [
            {
                index: true,
                element: <Navigate to="/posttest/menu" replace />
            },
            {
                path: 'menu',
                element: <Menu mode="posttest" />
            },
            {
                path: 'game',
                element: <GamePage mode="posttest" />
            },
            {
                path: 'games/:id/results',
                element: <ResultsPage mode="posttest" />
            },
        ]
    },
    {
        path: '/test-registration',
        element: <Root/>,
        children: [
            {
                index: true,
                element: <TestRegisterForm />
            },
        ]
    }
]);

// ... rest of the file ...

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router}/>
    </QueryClientProvider>
  </React.StrictMode>
);
