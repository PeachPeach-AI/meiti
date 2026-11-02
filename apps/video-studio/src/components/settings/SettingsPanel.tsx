'use client';
import { useAppStore } from '@/store';
import { Select } from '@/components/ui/Input';
import { RESOLUTIONS, FRAME_RATES, VIDEO_STYLES } from '@/types';

function BibleField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-[var(--app-text-secondary)]">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-16 w-full resize-none rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-2 text-xs text-[var(--app-text)] outline-none transition-colors placeholder:text-gray-400 focus:border-[var(--app-primary)]" />
    </label>
  );
}

function ProjectBiblePanel() {
  const bible = useAppStore((s) => s.projectBible);
  const updateBible = useAppStore((s) => s.updateProjectBible);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-alt)] p-2 text-[10px] leading-4 text-gray-400">
        这些项目级规则会作为人物、场景、空间、禁用项和 Seedance 生成约束的统一来源，用于减少抽卡漂移。
      </div>
      <BibleField label="人物库" value={bible.characters} onChange={(value) => updateBible({ characters: value })} placeholder="角色外貌、服装、发型、表情基准、禁止变化..." />
      <BibleField label="场景库" value={bible.scenes} onChange={(value) => updateBible({ scenes: value })} placeholder="地点、时代、材质、时间、天气、光源方向..." />
      <BibleField label="道具库" value={bible.props} onChange={(value) => updateBible({ props: value })} placeholder="关键道具、颜色、材质、出现镜头..." />
      <BibleField label="风格与色彩" value={[bible.styleRules, bible.colorRules].filter(Boolean).join('\n')} onChange={(value) => updateBible({ styleRules: value, colorRules: value })} placeholder="画面质感、主色、辅助色、禁用色、光影风格..." />
      <BibleField label="空间锁定" value={bible.spatialRules} onChange={(value) => updateBible({ spatialRules: value })} placeholder="左中右站位、视线关系、摄影机位置、光源方向、轴线规则..." />
      <BibleField label="全局禁用项" value={bible.negativeRules} onChange={(value) => updateBible({ negativeRules: value })} placeholder="不要文字、水印、变脸、肢体畸形、画面跳变..." />
      <BibleField label="Seedance 规则" value={bible.seedanceRules} onChange={(value) => updateBible({ seedanceRules: value })} placeholder="10 秒段落、首帧、时间线、结尾帧继承规则..." />
      <BibleField label="剧本诊断备注" value={bible.diagnosisNotes} onChange={(value) => updateBible({ diagnosisNotes: value })} placeholder="可生成性风险、容易翻车段落、建议拆短镜头..." />
      <BibleField label="剪辑声音备注" value={bible.postNotes} onChange={(value) => updateBible({ postNotes: value })} placeholder="字幕、环境声、拟音、转场、低频、发布备注..." />
    </div>
  );
}

export function SettingsPanel() {
  const store = useAppStore();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--app-border)] shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-text)]">参数配置</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-text-muted)]">项目规则、风格与默认参数</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

      <ProjectBiblePanel />

      <div className="border-t border-[var(--app-border)] pt-3">
        <div className="text-xs font-bold text-[var(--app-text)] uppercase tracking-wide mb-2">风格预设</div>
        <div className="grid grid-cols-3 gap-1">
          {VIDEO_STYLES.map((s) => (
            <button key={s.key} onClick={() => store.setSelectedStyle(s.key)}
              className={`text-xs py-1.5 px-2 rounded border transition-colors ${store.selectedStyle === s.key ? 'border-[var(--app-primary)] bg-[var(--app-primary-light)] text-[var(--app-primary)] font-bold' : 'border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-gray-400'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--app-border)] pt-3 space-y-2">
        <div className="text-xs font-bold text-[var(--app-text)] uppercase tracking-wide">默认参数</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">视频尺寸</div>
            <Select options={[
              { value: '1920x1080', label: '1920x1080 (16:9)' },
              { value: '1280x720', label: '1280x720 (16:9)' },
              { value: '3840x2160', label: '3840x2160 (16:9)' },
              { value: '1024x1024', label: '1024x1024 (1:1)' },
            ]} value={store.videoSize} onChange={(e) => store.setVideoSize(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">片质</div>
            <Select options={RESOLUTIONS.map((r) => ({ value: r, label: r }))} value={store.defaultResolution} onChange={(e) => store.setDefaultResolution(e.target.value as any)} />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">帧率</div>
            <Select options={FRAME_RATES.map((r) => ({ value: String(r), label: r + 'fps' }))} value={String(store.defaultFrameRate)} onChange={(e) => store.setDefaultFrameRate(Number(e.target.value) as any)} />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">参考图尺寸</div>
            <Select options={[
              { value: '1024x1024', label: '1024x1024 (1:1)' },
              { value: '1024x1792', label: '1024x1792 (9:16)' },
              { value: '1792x1024', label: '1792x1024 (16:9)' },
            ]} value={store.imageSize} onChange={(e) => store.setImageSize(e.target.value)} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
