// white, single-colour lab logos from @lobehub/icons-static-svg (mit).
// they take currentColor, so they follow the brand's white at any opacity.
import i_openai from '@lobehub/icons-static-svg/icons/openai.svg?raw'
import i_anthropic from '@lobehub/icons-static-svg/icons/anthropic.svg?raw'
import i_google from '@lobehub/icons-static-svg/icons/google.svg?raw'
import i_meta from '@lobehub/icons-static-svg/icons/meta.svg?raw'
import i_xai from '@lobehub/icons-static-svg/icons/xai.svg?raw'
import i_deepseek from '@lobehub/icons-static-svg/icons/deepseek.svg?raw'
import i_alibaba from '@lobehub/icons-static-svg/icons/qwen.svg?raw'
import i_mistral from '@lobehub/icons-static-svg/icons/mistral.svg?raw'
import i_moonshot from '@lobehub/icons-static-svg/icons/moonshot.svg?raw'
import i_zai from '@lobehub/icons-static-svg/icons/zai.svg?raw'
import i_minimax from '@lobehub/icons-static-svg/icons/minimax.svg?raw'
import i_amazon from '@lobehub/icons-static-svg/icons/aws.svg?raw'
import i_microsoft from '@lobehub/icons-static-svg/icons/microsoft.svg?raw'
import i_nvidia from '@lobehub/icons-static-svg/icons/nvidia.svg?raw'
import i_cohere from '@lobehub/icons-static-svg/icons/cohere.svg?raw'
import i_xiaomi from '@lobehub/icons-static-svg/icons/xiaomimimo.svg?raw'
import i_bytedance from '@lobehub/icons-static-svg/icons/bytedance.svg?raw'
import i_tencent from '@lobehub/icons-static-svg/icons/tencent.svg?raw'
import i_baidu from '@lobehub/icons-static-svg/icons/baidu.svg?raw'
import i_ai21 from '@lobehub/icons-static-svg/icons/ai21.svg?raw'
import i_01ai from '@lobehub/icons-static-svg/icons/yi.svg?raw'
import i_stepfun from '@lobehub/icons-static-svg/icons/stepfun.svg?raw'
import i_meituan from '@lobehub/icons-static-svg/icons/longcat.svg?raw'
import i_perplexity from '@lobehub/icons-static-svg/icons/perplexity.svg?raw'
import i_ibm from '@lobehub/icons-static-svg/icons/ibm.svg?raw'
import i_allenai from '@lobehub/icons-static-svg/icons/ai2.svg?raw'
import i_nous from '@lobehub/icons-static-svg/icons/nousresearch.svg?raw'
import i_inception from '@lobehub/icons-static-svg/icons/inception.svg?raw'
import i_upstage from '@lobehub/icons-static-svg/icons/upstage.svg?raw'
import i_cerebras_systems from '@lobehub/icons-static-svg/icons/cerebras.svg?raw'
import i_poolside from '@lobehub/icons-static-svg/icons/poolside.svg?raw'
import i_cursor from '@lobehub/icons-static-svg/icons/cursor.svg?raw'
import i_deep_cogito from '@lobehub/icons-static-svg/icons/deepcogito.svg?raw'
import i_arcee_ai from '@lobehub/icons-static-svg/icons/arcee.svg?raw'
import i_reka_ai from '@lobehub/icons-static-svg/icons/reka.svg?raw'
import i_stability_ai from '@lobehub/icons-static-svg/icons/stability.svg?raw'
import i_hugging_face from '@lobehub/icons-static-svg/icons/huggingface.svg?raw'

const RAW: Record<string, string> = {
  openai: i_openai,
  anthropic: i_anthropic,
  google: i_google,
  meta: i_meta,
  xai: i_xai,
  deepseek: i_deepseek,
  alibaba: i_alibaba,
  mistral: i_mistral,
  moonshot: i_moonshot,
  zai: i_zai,
  minimax: i_minimax,
  amazon: i_amazon,
  microsoft: i_microsoft,
  nvidia: i_nvidia,
  cohere: i_cohere,
  xiaomi: i_xiaomi,
  bytedance: i_bytedance,
  tencent: i_tencent,
  baidu: i_baidu,
  ai21: i_ai21,
  '01ai': i_01ai,
  stepfun: i_stepfun,
  meituan: i_meituan,
  perplexity: i_perplexity,
  ibm: i_ibm,
  allenai: i_allenai,
  nous: i_nous,
  inception: i_inception,
  upstage: i_upstage,
  'cerebras-systems': i_cerebras_systems,
  poolside: i_poolside,
  cursor: i_cursor,
  'deep-cogito': i_deep_cogito,
  'arcee-ai': i_arcee_ai,
  'reka-ai': i_reka_ai,
  'stability-ai': i_stability_ai,
  'hugging-face': i_hugging_face,
}

// inner markup of the 24x24 icon, without the <svg> wrapper or <title>
export function labLogo(lab: string): string | null {
  const raw = RAW[lab]
  if (!raw) return null
  return raw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
}
