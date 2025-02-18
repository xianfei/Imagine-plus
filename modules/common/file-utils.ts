import * as os from 'os'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'
import fileType from 'file-type'
import rawBody from 'raw-body'
import log from 'electron-log'
import { IImageFile, SupportedExt, SupportedExtAlias } from './types'

export const tmpdir = path.resolve(os.tmpdir(), 'imagine')

export const isSupportedExt = (type: string): type is SupportedExt => type in SupportedExt

export const cleanTmpdir = () => fs.emptyDirSync(tmpdir)

export function md5(text: string) {
  return crypto.createHash('md5').update(text).digest('hex')
}

export function getSize(filePath: string) {
  return fs.stat(filePath).then((stats) => stats.size)
}

export async function fileMD5(filePath: string) {
  const hash = crypto.createHash('md5')
  fs.createReadStream(filePath).pipe(hash)
  return rawBody(hash, {
    encoding: 'hex',
  })
}

export async function imageType(file: string | Buffer) {
  if (typeof file === 'string') {
    const stream = fs.createReadStream(file)
    const type = await fileType.fromStream(stream)
    stream.close()
    return type
  }
  return fileType.fromBuffer(file)
}

export const getFilePath = (image: Partial<IImageFile>) => path.resolve(tmpdir, `${image.id}.${image.ext}`)

export const getFileUrl = (filePath: string) => `file://${filePath}`

export const saveFilesTmp = (files: string[]) => Promise.all(files.map(async (file) => {
  const type = await imageType(file)
  const ext = type && type.ext

  if (!ext || !isSupportedExt(ext)) return null

  const id = md5(file) + await fileMD5(file)
  const size = await getSize(file)

  const descriptor: IImageFile = {
    size,
    id,
    ext,
    originalName: file,
    url: '',
  }

  const dest = getFilePath(descriptor)
  descriptor.url = getFileUrl(dest)

  await fs.copyFile(file, dest)

  return descriptor
}))

/**
 * get a unoccupied file path by an orignial path.
 * example: `/path/to/a.txt` to `/path/to/a(1).txt`
 * @param filePath - original file path
 */
export const unoccupiedFile = (filePath: string, index = 0): Promise<string> => {
  const accessPath = index
    ? filePath.replace(/(\.\w+)?$/, `(${index})$1`)
    : filePath

  return fs.access(accessPath)
    .then(() => unoccupiedFile(filePath, index + 1))
    .catch(() => accessPath)
}

/**
 * walk dir/file list to a flat files list
 */
export const flattenFiles = async (filePaths: string[]) => {
  let list: string[] = []

  for (const filePath of filePaths) {
    try {
      const stat = await fs.stat(filePath)
      if (stat.isFile()) {
        list.push(filePath)
      } else if (stat.isDirectory()) {
        if(filePath == '.' && (process.env.IMAGINE_ENV == 'development')) return []
        const dirFileNames = await fs.readdir(filePath)
        const dirFiles = dirFileNames.map((name) => path.resolve(filePath, name))
        const dirFlatFiles = await flattenFiles(dirFiles)
        list = list.concat(dirFlatFiles)
      }
    } catch (e) {
      log.error(`Failed to access file ${filePath}`)
    }
  }

  return list
}

/**
 * 'path/to/image.png' + jpg -> 'path/to/image.jpg'
 * @param filename - 'path/to/image.png'
 * @param ext - jpg
 */
export const reext = (filename: string, ext: SupportedExt) => filename.replace(/(?:\.(\w+))?$/i, ($0, $1: string) => {
  const matchedExt = $1.toLowerCase()

  // make sure `x.PNG` not be transformed to `x.png`
  if (matchedExt === ext || SupportedExtAlias[matchedExt] === ext) {
    return $0
  }

  if (matchedExt in SupportedExt) {
    return `.${ext}`
  }
  return `${$0}.${ext}`
})
