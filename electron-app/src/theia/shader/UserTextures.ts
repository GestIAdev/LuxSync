/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 USER TEXTURES — WAVE 8401 (Pack Latino · sampler `u_tex0`)
 *
 * Registro de texturas de artista que un átomo puede pedir con la cabecera
 *
 *     // @euclid tex0 logo-mg
 *
 * El motor la decodifica UNA vez (data-URI inlined por Vite → sin fetch de
 * red ni CORS bajo file://), la sube a la unidad TEXTURE3 y publica:
 *
 *     uniform sampler2D u_tex0;   // RGBA premultiplicada, mipmapped
 *     uniform float     u_hasTex0; // 1.0 cuando la textura está lista
 *
 * Contrato de la textura (léelo antes de escribir el átomo):
 *   · Origen abajo-izquierda (flipY en la creación del bitmap) — `uv` del
 *     átomo en [0,1] con Y hacia arriba la ve derecha.
 *   · RGBA8 PREMULTIPLICADA con el color aún en sRGB CODIFICADO (premultiplicar
 *     en espacio codificado evita el fleco oscuro de SRGB8_ALPHA8 en los
 *     bordes antialiasados). El átomo linealiza (γ2, sin `pow`):
 *       vec3 s = t.rgb / max(t.a, 1e-4);  vec3 lin = s * s * t.a;
 *     y compone `col = lin + bg * (1.0 - t.a)`. El alfa es lineal.
 *   · Mipmaps + LINEAR_MIPMAP_LINEAR: `texture(u_tex0, uv, bias)` con bias>0
 *     es un blur casi gratis (glow).
 *   · Mientras carga (o si falla) `u_hasTex0 == 0.0` — el átomo DEBE degradar
 *     con gracia (nunca pantalla negra).
 *
 * Compartido por theta.worker (pipeline principal) y GenRuntime (preview /
 * ventana HDMI Modo B): ambos contextos tienen su propia caché.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import logoMgUrl from './textures/logo-mg.png?inline'

/** Unidad de textura reservada para `u_tex0` (0=prev 1=flash 2=state). */
export const USER_TEX0_UNIT = 3

/** Nombre de cabecera → data-URI. Añadir aquí nuevas texturas de pack. */
const USER_TEXTURE_SOURCES: Readonly<Record<string, string>> = {
  'logo-mg': logoMgUrl,
}

export function hasUserTexture(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(USER_TEXTURE_SOURCES, name)
}

async function decodeBitmap(name: string): Promise<ImageBitmap | null> {
  const url = USER_TEXTURE_SOURCES[name]
  if (!url) return null
  const blob = await (await fetch(url)).blob()
  return createImageBitmap(blob, {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'premultiply',
    colorSpaceConversion: 'none',
  })
}

function uploadBitmap(
  gl: WebGL2RenderingContext,
  bitmap: ImageBitmap,
): WebGLTexture | null {
  const tex = gl.createTexture()
  if (!tex) return null
  // Guardamos el binding de TEXTURE_2D de la unidad activa para no pisar
  // el estado del frame en curso (la carga es async, cae entre frames).
  const prevBinding = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, prevBinding)
  return tex
}

/**
 * Caché por contexto GL. `acquire` es barato (Map.get) y se llama por frame;
 * la primera llamada por nombre dispara la carga async y devuelve null hasta
 * que la textura está subida.
 */
export class UserTextureCache {
  private readonly entries = new Map<string, WebGLTexture | 'loading' | 'failed'>()
  /** Se incrementa en dispose(): descarta cargas en vuelo de una era anterior. */
  private era = 0

  acquire(gl: WebGL2RenderingContext, name: string): WebGLTexture | null {
    const e = this.entries.get(name)
    if (e === undefined) {
      this.entries.set(name, 'loading')
      const era = this.era
      decodeBitmap(name)
        .then((bmp) => {
          if (!bmp) {
            this.entries.set(name, 'failed')
            return
          }
          if (era !== this.era) {
            bmp.close()
            return
          }
          const tex = uploadBitmap(gl, bmp)
          bmp.close()
          this.entries.set(name, tex ?? 'failed')
        })
        .catch((err: unknown) => {
          console.warn(`[UserTextures] '${name}' failed:`, err)
          if (era === this.era) this.entries.set(name, 'failed')
        })
      return null
    }
    return typeof e === 'string' ? null : e
  }

  dispose(gl: WebGL2RenderingContext | null): void {
    this.era++
    if (gl) {
      for (const e of this.entries.values()) {
        if (typeof e !== 'string') {
          try { gl.deleteTexture(e) } catch { /* contexto ya perdido */ }
        }
      }
    }
    this.entries.clear()
  }
}
