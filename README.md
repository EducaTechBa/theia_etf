# Theia IDE

## Prerequisites

 - Node.js `>= 10.11.0` **AND** `< 12.x`.
   - Preferably, **use** version `10.15.3`, it has the [active LTS](https://github.com/nodejs/Release).
   - Node.js `11.x` is untested.
   - Node.js `12.x` is [unsupported](https://github.com/eclipse-theia/theia/issues/5117).
 - [Yarn package manager](https://yarnpkg.com/en/docs/install) v1.7.0
 - git (If you would like to use the Git-extension too, you will need to have git version 2.11.0 or higher.)

Some additional tools and libraries are needed depending on your platform:

- Linux
  - [make](https://www.gnu.org/software/make/)
  - [gcc](https://gcc.gnu.org/) (or another compiling toolchain)
  - [pkg-config](https://www.freedesktop.org/wiki/Software/pkg-config/)
  - build-essential: `sudo apt-get install build-essential`
  - Dependencies for `native-keymap` node native extension:
    - Debian-based: `sudo apt-get install libx11-dev libxkbfile-dev`
    - Red Hat-based: `sudo yum install libX11-devel.x86_64 libxkbfile-devel.x86_64 # or .i686`
    - FreeBSD: `sudo pkg install libX11`

- Linux/MacOS
  - [nvm](https://github.com/nvm-sh/nvm) is recommended to easily switch between Node.js versions.

- Windows
  - We recommend using [`scoop`](https://scoop.sh/). The detailed steps are [here](#building-on-windows).


## Building 

- execute build.sh 

## Starting

- execute start.sh 

### Example start

- ./start.sh /path/to/workspace --port 8080  --hostname 0.0.0.0
- plugins are automatically included in the run script of yarn, see /app/package.json scripts

## Create new extension
- Run the interactive-generate.sh script 
- Name your extension 
- Choose a type (must be one of the 3 provided)
- Give it an author
- Set the licence
- Describe your extension
- After that, add your extension to the workspaces(/package.json) and dependencies(/app/package.json) as shown below.

Your extension should have a name that you provided and the /your-extension/package.json file should have it stored. Like this:

![](images/extension_package.png)

Use the name of your extension and the version where it needs to be provided. The /package.json file should look like this:

![](images/package.png)

The /app/package.json file should look like this: 

![](images/app_package.png)

Version 0.0.0 can be found in the /your-extension/package.json file


