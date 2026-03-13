import '../_tools/before-test'

import * as path from 'path'
import { tmpdir } from '../../common/file-utils'
import { toWebp } from '../../optimizers'

test('toWebp', async () => {
  const source = path.resolve(__dirname, '../_files/600_600.png')
  const target = path.resolve(tmpdir, `${Date.now()}_output_600_600.webp`)

  await toWebp(source, target, {})

  // JIMP NOT support for WebP
  // const diffResult = await fullDiff({
  //   actualImage: target,
  //   expectedImage: source,
  // })

  // expect(diffResult).toBeLessThan(0.01)
})
