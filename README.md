# 山东科技大学青岛校区校内导航

一个可实际运行的校内步行导航系统，前端使用 `React + Vite + TypeScript`，后端使用 `Express + TypeScript`。当前版本已经支持：

- 选择起点和终点
- 后端基于校园路网实时规划步行路线
- 在 GitHub Pages 这类静态环境下自动回退到前端本地路网规划
- 返回总距离、预计步行时间和分步导航说明
- 地图同步高亮起点、终点和推荐路线
- 首页搜索、分类筛选、分区筛选和地点详情直达

这不是纯静态导览页。默认模式下前端负责交互和展示，后端负责路线计算；当部署到 GitHub Pages 时，前端会自动启用内置路网规划，保证基础导航仍然可用。

## 当前架构

```text
src/                 React 前端
server/src/          Express 后端
shared/              前后端共享类型
public/maps/         校园底图
```

核心接口：

- `GET /api/health`
- `GET /api/navigation/bootstrap`
- `POST /api/navigation/route`

`POST /api/navigation/route` 请求体示例：

```json
{
  "startPlaceId": "west-gate",
  "endPlaceId": "library-information-center"
}
```

## 本地开发

```bash
npm install
npm run dev
```

这会同时启动：

- 前端开发服务器：`http://127.0.0.1:5173/#/`
- 后端 API 服务：`http://127.0.0.1:8787`

开发模式下，Vite 会把 `/api/*` 代理到后端。

如果需要启用高德实景地图，请在本地准备：

```bash
VITE_AMAP_JSAPI_KEY=你的高德 Web 端 Key
VITE_AMAP_SECURITY_JS_CODE=你的高德安全密钥
```

仓库内已提供 `.env.example` 作为模板，实际密钥建议只写入本地 `.env.local`。

## 生产运行

```bash
npm run build
npm start
```

启动后直接访问：

- `http://127.0.0.1:8787/#/`

如果只想一条命令本地预览生产版本：

```bash
npm run preview
```

## 测试与校验

```bash
npm run lint
npm run test
npm run build
```

仓库内置的 GitHub Actions 会自动执行这三项校验。

## 路网与地点数据

当前前后端已经包含首批可运行种子数据，重点文件如下：

- 前端展示数据：
  - `src/data/campus.ts`
  - `src/data/categories.ts`
  - `src/data/places.ts`
- 后端导航数据：
  - `server/src/data/navigation-seed.ts`
- 共享类型：
  - `shared/navigation.ts`

目前的路由规划基于图算法：

- 地点通过 `accessNodeIds` 连接到路网节点
- 后端在 `graphNodes + graphEdges` 上计算最短步行路径
- 返回折线路径和分步说明，而不是写死的静态路线模板

### 新增或维护地点

至少需要补齐：

- `id`
- `name`
- `categoryId`
- `zone`
- `description`
- `aliases`
- `keywords`
- `mapPoint`
- `accessNodeIds`
- `arrivalTips`

### 新增或维护路线

在 `server/src/data/navigation-seed.ts` 中维护：

- `graphNodes`
- `graphEdges`

推荐原则：

- 楼宇入口不要直接彼此相连
- 先建道路节点，再让地点挂到入口节点
- 每条边都写清距离和正反向提示文案

## 地图底图替换

当前底图文件：

- `public/maps/sdust-qingdao-campus-map.svg`

替换流程：

1. 用正式底图覆盖该文件，或修改 `mapAsset`
2. 微调地点 `mapPoint`
3. 微调后端 `graphNodes` 坐标
4. 本地重新验证路线是否穿过正确道路

## 部署

### GitHub Pages

仓库已经内置 Pages 工作流，推荐部署方式是：

1. 新建一个**单独仓库**，例如 `sdust-qingdao-campus-navigation`
2. 推送代码到该仓库的 `main` 分支
3. 在仓库 `Settings -> Pages` 中确认 `GitHub Actions` 为发布源
4. 等待 `.github/workflows/deploy.yml` 完成后，站点会发布到：

```text
https://<你的 GitHub 用户名>.github.io/<repo>/
```

这种方式不会影响你原来的 `2830500285.github.io` 个人主页，因为它会以**项目站点**的形式单独发布。

### Pages 能力边界

GitHub Pages 只负责静态前端，所以线上行为会分成两种：

- 如果配置了单独的后端并通过 `VITE_API_BASE_URL` 指向它，前端会优先调用后端接口
- 如果没有后端，前端会自动回退到仓库内置的本地路网规划器，起终点导航依然可用

注意：

- 高德实景地图和高德实时 POI 依赖 `VITE_AMAP_JSAPI_KEY` 与 `VITE_AMAP_SECURITY_JS_CODE`
- 如果没有在构建环境中配置这两个变量，Pages 站点仍可用，但会默认显示校内路网示意图

### Docker

仓库已经提供 `Dockerfile`，可直接构建并运行：

```bash
docker build -t sdust-navigation .
docker run -p 8787:8787 sdust-navigation
```

### 常见可部署平台

可直接部署到支持 Node 服务的环境，例如：

- Render
- Railway
- 云服务器
- 支持 Docker 的平台

## 当前边界

当前版本已经可用于“校内地点之间的步行导航”，但还没有做这些能力：

- 室内导航
- 浏览器定位映射到最近路网节点
- 临时封路后台管理
- 管理员维护界面
- 多校区切换

如果要继续往正式系统推进，下一阶段优先级应当是：

1. 接入真实校区底图和正式地点清单
2. 补全更多路网节点与边
3. 增加封路/绕行规则
4. 接入后台数据维护能力
