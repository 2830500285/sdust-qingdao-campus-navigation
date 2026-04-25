import type { CampusConfig } from '../types/navigation'

export const campusConfig: CampusConfig = {
  id: 'sdust-qingdao',
  name: '山东科技大学青岛校区',
  city: '青岛西海岸新区',
  description:
    '以步行导向为核心的校内导航首页，集中展示图书信息中心、工程实训中心、教学楼、公寓、校门与公共服务点位。',
  mapAsset: 'maps/sdust-qingdao-campus-map.svg',
  mapAlt: '山东科技大学青岛校区导航底图',
  mapNote:
    '当前仓库内置的是可替换矢量底图。拿到校方正式平面图后，只需替换 public/maps 下的文件并保留同名资源即可。',
  defaultView: {
    centerLabel: '校园中轴',
    highlightedZones: ['中轴教学区', '北侧科研区', '南侧生活区', '西部门户区'],
  },
}

export const campusZones = [
  {
    name: '中轴教学区',
    summary: '围绕图书信息中心、逸夫楼与行政楼展开，是查课、办事和会合频率最高的区域。',
  },
  {
    name: '北侧科研区',
    summary: '工程实训中心和实验空间集中在这一带，适合实验课、竞赛训练和工程实践相关导航。',
  },
  {
    name: '南侧生活区',
    summary: '学生公寓、餐厅和校医院分布在此，面向日常生活路线与夜间回宿需求。',
  },
  {
    name: '西部门户区',
    summary: '连接西门、学术交流中心与运动场，是访客进校、活动签到和大型集结的常用入口。',
  },
] as const
