module.exports = {
  packagerConfig: {
    asar: false,
    dir: '.',
    out: 'forge-out',
    name: 'Docutrack',
    executableName: 'Docutrack',
    icon: 'resources/mosr-logo',
    ignore: [/^\/temp-package/, /^\/\.git/, /^\/dist/]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'docutrack',
        setupIcon: 'resources/mosr-logo.ico',
        exe: 'Docutrack.exe'
      }
    }
  ]
}
