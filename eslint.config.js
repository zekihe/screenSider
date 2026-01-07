import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

export default [
    js.configs.recommended,
    prettierConfig,
    // 基础配置
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                // 基础全局变量
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly'
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            }
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            prettier
        },
        rules: {
            // Prettier rules
            'prettier/prettier': 'error',
            // React rules
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            // React Hooks rules
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            // General rules
            'no-unused-vars': 'warn'
        },
        settings: {
            react: {
                version: 'detect'
            }
        }
    },
    // 渲染器进程配置 (浏览器环境)
    {
        files: ['src/renderer/**/*.{js,jsx}'],
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                navigator: 'readonly',
                MediaRecorder: 'readonly',
                Blob: 'readonly',
                URL: 'readonly'
            }
        }
    },
    // 主进程配置 (Node.js 环境)
    {
        files: ['src/main/**/*.js', 'main.js'],
        languageOptions: {
            globals: {
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                require: 'readonly',
                module: 'readonly',
                MAIL_WINDOW_VITE_DEV_SERVER_URL: 'readonly',
                MAIN_WINDOW_VITE_DEV_SERVER_URL: 'readonly'
            }
        }
    },
    // 预加载脚本配置
    {
        files: ['src/preload/**/*.js'],
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                process: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                // Electron 预加载全局变量
                electron: 'readonly',
                contextBridge: 'readonly',
                ipcRenderer: 'readonly'
            }
        }
    }
]
