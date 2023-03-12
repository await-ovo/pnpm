import path from 'path'
import { parseWantedDependency, ParseWantedDependencyResult } from '@pnpm/parse-wanted-dependency'
import { prompt } from 'enquirer'
import { readCurrentLockfile } from '@pnpm/lockfile-file'
import { nameVerFromPkgSnapshot } from '@pnpm/lockfile-utils'
import { PnpmError } from '@pnpm/error'
import { WANTED_LOCKFILE } from '@pnpm/constants'
import semver from 'semver'

export async function getPatchedDependency (rawDependency: string, lockfileDir: string): Promise<ParseWantedDependencyResult> {
  const dep = parseWantedDependency(rawDependency)

  const { versions, preferredVersions } = await getVersionsFromLockfile(dep, lockfileDir)

  if (!preferredVersions.length) {
    throw new PnpmError(
      'PATCH_VERSION_NOT_FOUND',
      `Can not find ${rawDependency} in project ${lockfileDir}, ${versions.length ? `you can specify currently installed version: ${versions.join(', ')}.` : `did you forget to install ${rawDependency}?`}`
    )
  }

  dep.alias = dep.alias ?? rawDependency
  if (preferredVersions.length > 1) {
    const { version } = await prompt<{
      version: string
    }>({
      type: 'select',
      name: 'version',
      message: 'Choose which version to patch',
      choices: versions,
    })
    dep.pref = version
  } else {
    dep.pref = preferredVersions[0]
  }

  return dep
}

async function getVersionsFromLockfile (dep: ParseWantedDependencyResult, lockfileDir: string) {
  const lockfile = (await readCurrentLockfile(path.join(lockfileDir, 'node_modules/.pnpm'), {
    ignoreIncompatible: true,
  }))

  if (!lockfile) {
    throw new PnpmError(
      'PATCH_NO_LOCKFILE',
      `No ${WANTED_LOCKFILE} found: Cannot patch without a lockfile`
    )
  }

  const pkgName = dep.alias && dep.pref ? dep.alias : (dep.pref ?? dep.alias)

  const versions = Object.entries(lockfile.packages ?? {})
    .map(([depPath, pkgSnapshot]) => nameVerFromPkgSnapshot(depPath, pkgSnapshot))
    .filter(({ name }) => name === pkgName)
    .map(({ version }) => version)

  return {
    versions,
    preferredVersions: versions.filter(version => dep.alias && dep.pref ? semver.satisfies(version, dep.pref) : true),
  }
}
