---
layout: post_tagged
title: "Operating System Fundamentals with TypeScript (Part 2): The Boot Sequence and Terminal Control"
subtitle: "Managing the OS Lifecycle and User Interaction"
date: 2026-01-30 00:40:00
background: "/assets/boot-cat.jpg"
tags: ["Series: Operating System Fundamentals with TypeScript", "OllieOS", "Operating Systems", "Learning"]
---

In [Part 1](https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html), we covered the "brain" of an operating system, the kernel. But a brain in a jar is useless if it has no way to communicate or wake up.
In this post, we'll bridge that gap.
We'll start by walking through the boot sequence to see how the system transitions from a static browser tab to a fully functioning user environment.
Then, we'll discuss implementation of terminal control to listen from and respond to the user.

As a reminder, we'll use TypeScript examples from [OllieOS](https://ollieg.codes) to give a high-level implementation of these concepts.

## What is a bootloader and why do we need one?

Any useful computer needs to read programs from the disk and run them.
However, when a computer is powered on, it doesn't know how to do this yet, because as covered in [Part 1](https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html), the OS is responsible for filesystem management and loading programs into memory.

To solve this problem, we use a small program called a bootloader. The bootloader is stored in a small, special location on the disk that the computer's firmware knows to look for when it starts up.
This firmware is called the BIOS (Basic Input/Output System) on older computers, and UEFI (Unified Extensible Firmware Interface) on modern ones.
The bootloader's job is to initialise the hardware and load the main operating system kernel into memory, then transfer control to it.

The bootloader, as well as some hardware properties can be configured by the user through a setup utility provided by the BIOS/UEFI (spamming the DEL or F2 key during boot is a common way to access this).

## The boot sequence

You may have noticed that the power on process for a computer is akin to a relay race of small programs handing off control to each other.
Here's a simplified overview of a typical boot sequence:
1. **Power On**: The user presses the power button, and the computer's power supply delivers power to the motherboard and other components.
2. **BIOS/UEFI**: The firmware checks the hardware (power-on self test, or POST), initialises basic hardware components such as the CPU, memory, and storage devices, and looks for a bootloader on the configured boot device.
3. **Bootloader**: The bootloader is loaded from the storage device into memory and executed. It may present a boot menu if multiple operating systems are available.
4. **Kernel**: The bootloader loads the operating system kernel into memory and transfers control to it.
5. **PID 1**: The first process is started by the kernel. This is called the [init system](#the-init-system), which will be covered in more detail later.

This sequence creates a chain of trust, where each stage is responsible for loading and verifying the next stage.
This means the complexity of each stage can be kept minimal, as each stage only needs to know how to load the next one.

### How OllieOS boots

In a way, we can consider the new tab that runs OllieOS in the browser as the "BIOS/UEFI" stage.
When the user opens the tab, the browser initialises a JavaScript runtime environment and loads the bootloader code.

This code is responsible for first setting up the kernel components:

<iframe frameborder="0" scrolling="no" style="width:100%; height:1129px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fos_loader.ts%23L23-L72&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Notice how there is a check to see if the browser supports the superior OPFS backed filesystem, falling back to `LocalStorageFS` if not.

And then initialising the `Kernel` class instance and calling its `boot()` method, which starts the kernel initialisation process and runs the OS until completion:

<iframe frameborder="0" scrolling="no" style="width:100%; height:205px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fos_loader.ts%23L116-L121&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

The bootloader code is pretty minimal. The behaviour of the OS is fully contained within the kernel and its subsystems.

On the web, the bootloader is a code split entrypoint.
On page load, the browser downloads a very minimal JavaScript bundle containing just enough code to display a loading screen, and then invokes another download containing the bootloader and the OS.
The benefit of this is that the loading screen is displayed almost immediately while the larger OS code is being downloaded in the background.

As for the `kernel.boot()` method, this is where the kernel spawns the user's chosen [init system](#the-init-system):

<iframe frameborder="0" scrolling="no" style="width:100%; height:1339px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Findex.ts%23L387-L446&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

## The init system

As mentioned, the kernel starts the init system as the first process (PID 1).
The init system is responsible for running background services (daemons), managing user sessions, and typically other system utilities such as power management and logging.
Real world examples of init systems include [systemd](https://systemd.io/) (most common) and [OpenRC](https://wiki.gentoo.org/wiki/OpenRC).

The init system is designed as a critical component of the operating system. The kernel monitors the init system process.
If it exits unexpectedly/crashes, this kernel assumes the system state is unrecoverable and triggers a kernel panic (the most severe type of error, halting computer operation).

Typically, the init system will spawn another process to manage user sessions, such as [getty](https://en.wikipedia.org/wiki/Getty_(Unix)) for text-based terminals or a display manager for graphical environments.
This is run in a respawn loop, so if the user logs out or the session process crashes, the init system will restart it without an entire system reboot.

An init system runs system services in the background. A key aspect of this is calculating the start order of services based on their dependencies.
If service A depends on service B, the init system must ensure that service B is started before service A.
Services define their dependencies in configuration files, which the init system reads during startup to build a dependency graph.
The init system then uses this graph to determine the correct order to start services, ensuring that all dependencies are met before a service is launched.

Note: This specific chain describes Unix-like operating systems.
While Windows uses a more complex architecture involving distributed subsystems (smss.exe, csrss.exe, wininit.exe, services.exe, etc.), the abstract goal is the same.
You can reasonably think of these components combined as the Windows equivalent of an init system.
For those interested, [this chapter of Windows Internals](https://www.microsoftpressstore.com/articles/article.aspx?p=2201310) documents the Windows boot process in depth quite well.
It's a little old, newer Windows systems will use UEFI (so not MBR), secure boot, and virtualisation-based security features, but the core initialisation process remains similar.

### Tangent: Inter-process communication (IPC)

It's quite common for a program to need to communicate with another program. In fact, to manage the init system, we need a way for users to interact with it (e.g. to start/stop services, shut down/reboot the system, etc.).
However, due to the fact that processes are isolated from each other, they (thankfully!) cannot directly access each other's memory or resources.
Instead, we need a designated way for them to communicate.

This is called inter-process communication (IPC).
IPC allows processes to exchange data and signals in a controlled manner.

There are several IPC mechanisms available, including:
- **Pipes**: A unidirectional (one way) communication channel that allows one process to send data to another. Pipes are often used for simple data streams. When you run a command in a Unix shell and pipe its output to another command (e.g. `ls | grep "txt"`), you're using pipes.
- **Message Queues**: A system that allows processes to send and receive messages in a queued manner. This is useful for asynchronous communication.
- **Shared Memory**: A section of memory that can be accessed by multiple processes. This allows for fast data exchange, but requires synchronisation mechanisms to prevent data corruption.
- **Sockets**: A communication layer that allows processes to communicate either within the same machine or over a network. When you connect to the Internet, your browser uses sockets to communicate with web servers.
- **Signals**: A very limited form of IPC utilising the built-in kernel signalling to notify a process that a specific event has occurred (e.g. `SIGINT` for interrupt).

The kernel provides primitives and APIs for processes to use these IPC mechanisms.

#### How OllieOS implements IPC

OllieOS utilises a simplified IPC architecture, with a message passing system built into the kernel. Processes create duplex "channels" between each other to transmit messages both ways:

<iframe frameborder="0" scrolling="no" style="width:100%; height:478px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fprocesses.ts%23L5-L23&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Additionally, it maintains a map of IPC "services", allowing processes to register themselves with a friendly name which other processes can look up to create a connection.
This is a bit more "batteries included" than a traditional kernel would provide, but it simplifies development for our purposes.
On a Linux system, you'd typically use a userspace service like [D-Bus](https://dbus.freedesktop.org/) for service discovery functionality.

A process can use `kernel.get_ipc().create_channel()` to create a channel to a service:

<iframe frameborder="0" scrolling="no" style="width:100%; height:436px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fprocesses.ts%23L130-L146&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

The target process will be informed via its service callback when a new channel is made with it. Both ends listen to the channel when it is created with `channel_listen()`:

<iframe frameborder="0" scrolling="no" style="width:100%; height:436px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fprocesses.ts%23L170-L186&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

And then either party can send messages to the other using `channel_send()`:

<iframe frameborder="0" scrolling="no" style="width:100%; height:919px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fprocesses.ts%23L207-L246&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

### OllieOS's init system: ignition

OllieOS includes the default init system `ignition`.

This program reads `/etc/boot_target` to determine what program it should launch as the user session manager.
By default, this is `jetty`, a simple single session terminal manager that respawns the user's shell over and over again whenever it exits.

<iframe frameborder="0" scrolling="no" style="width:100%; height:667px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fprograms%2Fcore%2Fignition%2Findex.ts%23L81-L108&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Next, it initialises a service manager and loads service configuration files from `/etc/services/`:

<iframe frameborder="0" scrolling="no" style="width:100%; height:184px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fprograms%2Fcore%2Fignition%2Findex.ts%23L110-L114&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Next, it registers an IPC service called "init" to allow management from other processes. The program `spark` comes included with OllieOS to provide a command line interface to control the init system via this IPC service.

<iframe frameborder="0" scrolling="no" style="width:100%; height:835px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fprograms%2Fcore%2Fignition%2Findex.ts%23L117-L152&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

(and so on)

Afterwards, it calculates the order to start services based on their dependencies, and starts them:

<iframe frameborder="0" scrolling="no" style="width:100%; height:205px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fprograms%2Fcore%2Fignition%2Fservices.ts%23L143-L148&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Finally, it runs the boot target in a respawn loop, this time launching a recovery environment if it crashes more than 5 times in quick succession:

<iframe frameborder="0" scrolling="no" style="width:100%; height:1381px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fprograms%2Fcore%2Fignition%2Findex.ts%23L218-L279&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

This is quite a large sample, but it is essentially the same logic used by the kernel to spawn the init system, albeit a little smarter to implement the recovery fallback.

It's worth noting that init systems in OllieOS are run in privileged mode. In real life, it is unlikely the init system would run with ring 0 privileges, but would at least run at root user level.
Due to OllieOS being single user and not having this distinction, it runs with "kernel privileges". Refer back to [Part 1](https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html#how-ollieos-implements-the-kernel) for more information on how OllieOS specifically handles this simplified privilege model.

Since drivers aren't all that important in a web-based OS, OllieOS doesn't make this distinction. Instead, `ignition` can spawn privileged services that can access kernel features directly. This is why it is given kernel privileges when spawned by the kernel.

## Terminal drivers and line discipline

Traditionally, a terminal is a "dumb" device that simply displays text and sends keystrokes back to the computer.
To manage this interaction, operating systems kernels implement terminal drivers and line discipline.

A terminal driver (or TTY driver, named after old school teletypewriters) is responsible for managing the low-level details of communicating with the terminal hardware. This involves aspects such as communicating over serial ports, handling baud rates, and managing character encoding.
It is a driver in the same sense you may have a driver for a mouse or a graphics card, just for a terminal device. In modern systems, terminal drivers interface with virtual terminals called terminal emulators, which simulate terminal behaviour in software.

Line discipline is a layer that sits between the terminal driver and the applications using the terminal. It is responsible for interpreting the input and output data streams according to specific rules and conventions.
Some of the key functions of line discipline include:
- **Input handling**: Capturing keystrokes sent from the terminal and passing them to the OS. This involves creating a buffer to store incoming characters until the user presses Enter.
- **Output handling**: Sending text and control codes from the OS to the terminal for display.
- **Echoing**: When a user types a character, the terminal driver often echoes it back to the terminal so the user can see what they typed.
- **Special characters**: Interpreting special characters (like backspace, delete, arrow keys) to manage the input buffer.
- **Signal generation**: Generating signals (like `SIGINT` for Ctrl+C) based on specific input sequences.
- **Character translation**: Formatting input and output data, such as converting newline characters to carriage return and line feed sequences for application consistency and proper display on the terminal.

It should be noted that the above cases describe the canonical mode of terminal operation, where input is buffered until a newline is received. This is what is used for typical command-line interfaces.
There is also a raw mode, where keystrokes are sent directly to the application without any processing. This is used for applications that need more direct control over input, such as text editors or games.

### How OllieOS implements terminal control

On the web, OllieOS uses the library [xterm.js](https://xtermjs.org/) to create a terminal emulator in the browser DOM. This library is used by many browser-based IDEs such as VSCode to render a terminal.

However, this doesn't give us everything we need to interact with the user. The role of xterm.js is to faithfully render text (including ANSI escape codes for colours and cursor movement) and capture keyboard input.
We need to implement the logic to interpret that input and manage the terminal state ourselves.

OllieOS extends the `Terminal` class from xterm.js to create a `WrappedTerminal` class to implement the logic for text input and output.

It buffers keypress events received from xterm.js as an event queue. The benefit of this is that it means pasting text into the terminal is handled gracefully, as the entire pasted string is queued up and processed character by character:

<iframe frameborder="0" scrolling="no" style="width:100%; height:268px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fterm_ctl.ts%23L393-L401&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Then programs can either read a whole line with `term.read_line()` (canonical line discipline) which handles backspaces, arrow keys, Enter key, etc. Any printable keys pressed are echoed then stored in the line buffer that `read_line()` collects and returns when Enter is pressed (not shown in snippet):

<iframe frameborder="0" scrolling="no" style="width:100%; height:1507px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fterm_ctl.ts%23L138-L205&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Alternatively, programs can read raw keystrokes in an event driven way using `term.wait_for_keypress()`:

<iframe frameborder="0" scrolling="no" style="width:100%; height:436px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fterm_ctl.ts%23L421-L437&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

As a bonus, every ANSI escape code is exposed in an object `term.ansi` for easy access. For example, `term.ansi.FG.GREEN` gives the escape code to set the foreground colour to green.

## Conclusion

We've now covered the boot sequence of an operating system, from power on to user session management.
We've also explored how terminal drivers and line discipline allow the OS to interact with users through text-based terminals.

However, these are just the two pillars we needed to get the OS up and running, and to give programs a way to interact with users.

We need to provide users a **shell**, a command line interface to execute commands.
A shell uses line discipline to read a command from the user, then parses and executes it.
You can think of it just like a REPL (Read-Eval-Print Loop) you would get with Node.js, Python, and other programming languages, except for spawning programs.

The session manager is responsible for launching the shell when a user logs in.
It's important to remember a shell isn't special, it's just a userspace program that uses the features provided by the terminal driver and line discipline to interact with the user.
Anybody can make their own shell program and therefore change the behaviour of the command line interface.

In part 3, we'll explore the **components of a simple command-line shell**, as well as looking at how programs are actually loaded and executed by the OS.

(will be linked here when published)

---

**A note on educational use**: You are welcome to adapt the concepts and explanations in this post for teaching purposes, provided you attribute me following the citations below.

However, please note that the OllieOS codebase is **proprietary and strictly copyrighted**. You may **not** use, copy, modify, or distribute the code itself.

### Plaintext (APA Style)

Ollie G. (2026, January 30). *Operating System Fundamentals with TypeScript (Part 2): The Boot Sequence and Terminal Control*. Retrieved from [https://blog.ollieg.codes/2026/01/30/building-an-os-pt2.html](https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html)

### Markdown

```markdown
Ollie G. (2026). *Operating System Fundamentals with TypeScript (Part 2): The Boot Sequence and Terminal Control*. Retrieved from https://blog.ollieg.codes/2026/01/30/building-an-os-pt2.html
```

### HTML

```html
<p>
  Ollie G. (2026). <em>Operating System Fundamentals with TypeScript (Part 2): The Boot Sequence and Terminal Control</em>. 
  Retrieved from <a href="https://blog.ollieg.codes/2026/01/30/building-an-os-pt2.html">https://blog.ollieg.codes/2026/01/30/building-an-os-pt2.html</a>
</p>
```

### BibTeX

```bibtex
@misc{ollieg2026buildingos2,
  author = {G, Ollie},
  title = {Operating System Fundamentals with TypeScript (Part 2): The Boot Sequence and Terminal Control},
  year = {2026},
  month = {January},
  day = {30},
  url = {https://blog.ollieg.codes/2026/01/30/building-an-os-pt2.html},
  note = {Accessed: 2026-01-30}
}
```
