export interface BuiltinBackground {
  id: string
  name: string
  desc: string
  fg: string
  sub: string
  accent: string
  soft: string
  src: string
}

const LIGHT = { fg: '#1c1917', sub: '#44403c', soft: '#a8a29e' }

function bg(
  n: number,
  name: string,
  desc: string,
  accent: string,
  palette: Partial<Pick<BuiltinBackground, 'fg' | 'sub' | 'soft'>> = {},
  ext = 'jpg',
): BuiltinBackground {
  const id = `material-${String(n).padStart(2, '0')}`
  return {
    id,
    name,
    desc,
    fg: palette.fg || LIGHT.fg,
    sub: palette.sub || LIGHT.sub,
    accent,
    soft: palette.soft || LIGHT.soft,
    src: `/cover-assets/${id}.${ext}`,
  }
}

/** 用户提供的 24 张手账/便签底图。按“封面 → 内容卡”都能直接铺满 1080×1440。 */
export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = [
  bg(1, '橙圈手账', '橙色线圈、白色内页，活泼但不吵', '#ea580c'),
  bg(2, '黄格便签', '黄色格纸、胶带与手账元素', '#d97706'),
  bg(3, '手绘黄框', '黄色手绘边框、星星与小树', '#ea580c'),
  bg(4, '折角黄纸', '黄色纸张、方格与折角', '#ca8a04'),
  bg(5, '蓝底揉纸', '蓝色底 + 白色揉纸，干净清爽', '#2563eb'),
  bg(8, '蓝底书桌', '台灯、水杯、笔记本电脑，生活感', '#0284c7'),
  bg(9, '黄蓝便签', '黄蓝撞色、星星与三角尺', '#2563eb'),
  bg(10, '蓝色夹页', '蓝色底 + 打孔白纸 + 回形针', '#2563eb'),
  bg(11, '绿色线圈', '浅绿格底 + 线圈白纸', '#16a34a'),
  bg(12, '米色虚线', '米色底 + 虚线内框，极简', '#b45309'),
  bg(13, '杏色边框', '杏色底 + 橙色细边，温柔', '#ea580c'),
  bg(14, '奶油便签', '奶油白便签 + 细边框', '#ca8a04'),
  bg(15, '绿色云朵', '薄荷绿底 + 白色云朵形内页', '#059669'),
  bg(16, '蓝白撕纸', '蓝白条纹底 + 撕纸边', '#2563eb'),
  bg(17, '蓝白云朵', '蓝底 + 云朵形白纸 + 小装饰', '#0ea5e9'),
  bg(18, '蓝白夹页', '蓝白格底 + 云朵纸 + 回形针', '#2563eb'),
  bg(19, '紫色蛋糕', '紫格底 + 奶油色内页 + 小蛋糕', '#7c3aed'),
  bg(20, '粉色点点', '粉色点点底 + 奶油内页', '#db2777'),
  bg(21, '蓝色刷边', '蓝色底 + 白色刷边内页', '#2563eb'),
  bg(22, '蓝格刷边', '蓝格底 + 白色刷边内页', '#2563eb'),
  bg(23, '木质夹板', '木质夹板 + 白色纸张 + 小图标', '#92400e'),
  bg(24, '黄花框', '浅黄底 + 黄色圆角框 + 花朵', '#eab308'),
  bg(6, '蓝边水彩', '蓝白水彩边框，留白多', '#0284c7'),
  bg(7, '纯蓝底', '整张蓝色底，适合白字强冲击', '#fbbf24', { fg: '#f8fafc', sub: '#dbeafe', soft: '#93c5fd' }),
]
