---
layout: post_tagged
title: "Operating System Fundamentals with TypeScript (Part 1): The Kernel, Scheduler, and Filesystem"
subtitle: "The Building Blocks of an OS, Implemented in a High-Level Language"
date: 2026-01-29 22:53:00
background: "/assets/circuit-board.jpg"
tags: ["Series: Operating System Fundamentals with TypeScript", "OllieOS", "Operating Systems", "Learning"]
---

Operating system development is a daunting task. Implementing an operating system requires deep knowledge of hardware architecture, low-level programming, and system design.
You are given nothing. No C runtime, no standard libraries, not even a native print() function. All you have is a BIOS and bare metal.

Given this, it is often difficult to teach OS concepts in a practical sense. OS developers use low level features of Assembly and C, because you simply don't have the luxury of higher level languages.
However, what if we could simulate an operating system in a web browser, using a high level language like TypeScript?

This is precisely what I set out to do with [OllieOS, my browser-based operating system.](https://ollieg.codes) OllieOS demonstrates the key architectural concepts of an operating system, while abstracting away the low-level complexities.
OllieOS takes Unix-like design principles and implements them in a high-level environment. It simulates functions of an operating system kernel without needing to talk to hardware directly. I've been working on it since 2022!

This post explains the core aspects of operating system architecture, and demonstrates how they are implemented in OllieOS using TypeScript. It is targeted at developers who are familiar with operating systems at a high level, but want to see how these concepts can be implemented in practice.

## What is an operating system, anyway?

It's common to think that an operating system is just the user interface. Windows is an OS, so the OS must just be the desktop and file explorer, right?
However, an operating system is much more than just the user interface. It is the overarching manager of the computer system, providing a bridge between hardware and software.

An operating system provides several key functions:
- **Process management**: The OS manages running programs, allocating CPU time and resources to each process.
- **Memory management**: The OS allocates and manages system memory, ensuring that each process has access to the memory it needs.
- **File system management**: The OS provides a way to store and retrieve files on disk, managing file permissions and organisation.
- **Device management**: The OS manages hardware devices, providing drivers and interfaces for software to interact with them.
- **User interface**: The OS provides a way for users to interact with the system, whether through a command line or graphical interface.

It is the duty of the operating system to provide a reliable interface for programs to interact with these functions, while also controlling how programs are allowed to access system resources.

### Goals of an operating system

Beyond the explicit functions of an operating system, there are a few common goals that guide OS design:

#### Abstraction

Hardware is complex. To write a file to a hard drive, you need to talk to the disk controller, spin the platter, and move the read/write head. Plus, you would need to know that a hard drive was in use in the first place, not an SSD, USB or any other storage device. The OS abstracts away this complexity, providing a simple interface for programs to read and write files without needing to know the details of the hardware.

#### Arbitration

Resources are limited. Multiple programs may want to use the CPU, memory, or disk at the same time. The OS arbitrates access to these resources, ensuring that each program gets a fair share and preventing conflicts.

#### Isolation

Programs should not be able to interfere with each other. A buggy program should not be able to crash the entire system or access another program's data. The OS isolates programs from each other, providing memory protection and process isolation.

### How OllieOS implements these concepts

Of these functions and goals, OllieOS implements the *logical* architecture while delegating the *physical* machinery to the host environment (the browser and JavaScript engine).
It features a fully functional Process Scheduler, a hierarchical File System, and a User Interface (with xterm.js and virtual windows), but it skips Device Management and low-level Memory mapping.
This distinction highlights the power of abstraction.

Because the OllieOS kernel interacts with an `AbstractFileSystem` interface rather than raw hardware, the core operating system is completely agnostic to its environment.
In fact, this abstraction is so effective that I was able to [port OllieOS to run in a Node.js terminal](https://github.com/obfuscatedgenerated/ollieos_node) simply by writing a new filesystem implementation and swapping out xterm.js to directly write to the terminal.

And don't worry, examples are coming in the following sections! If you're eager to read the code and follow along, check out the [OllieOS GitHub repository](https://github.com/obfuscatedgenerated/obfuscatedgenerated.github.io).
Otherwise, snippets will be embedded throughout this post.

## But what is a kernel?

The kernel is the core of the operating system. It is responsible for the low-level management of system resources, including process scheduling, memory management, and file system management.
The kernel runs in a privileged mode, with direct access to hardware resources. It is the only code that is trusted to talk directly to the hardware. It is the specific component implementing the [goals of an operating system](#goals-of-an-operating-system).

In the real world, this trust is implemented with CPU privilege levels, commonly called "rings". These are a value stored in a CPU register that indicates the current privilege level of the executing code.
The rings are as follows:
- **Ring 0**: Kernel mode. Code running in Ring 0 can execute any CPU instruction and access any memory address. This is where the kernel, and commonly device drivers, run.
- **Ring 1 and Ring 2**: Practically never used, but still exist in most CPUs in case an OS wants to! See [this StackOverflow answer](https://security.stackexchange.com/a/127131/281231) for more details.
- **Ring 3**: User mode. Code running in Ring 3 is restricted from executing certain CPU instructions and accessing certain memory addresses. This is where user applications run.

<figure style="text-align: center; width: 75%; margin: 1em auto;">
<img src="/assets/Priv_rings.svg" alt="Privilege rings for the x86 available in protected mode" style="max-width: 100%; height: auto;" />
<figcaption>By <a href="https://en.wikipedia.org/wiki/User:Hertzsprung" class="extiw" title="wikipedia:User:Hertzsprung">Hertzsprung</a> at <a href="https://en.wikipedia.org/wiki/" class="extiw" title="wikipedia:">English Wikipedia</a>, <a href="http://creativecommons.org/licenses/by-sa/3.0/" title="Creative Commons Attribution-Share Alike 3.0">CC BY-SA 3.0</a>, <a href="https://commons.wikimedia.org/w/index.php?curid=8950144">Link</a></figcaption>
</figure>

It is common to hear the terms "userspace" and "kernelspace" used to describe the two modes of operation. Userspace is ring 3, where user applications run, and kernelspace is ring 0, where the kernel runs.

These rings are enforced by the CPU hardware. If a program running in ring 3 tries to execute a privileged instruction or access a restricted memory address, the CPU will raise an exception and crash the program.

### How OllieOS implements the kernel

The OllieOS kernel is split into several key components managed by the `Kernel` class.

<iframe frameborder="0" scrolling="no" style="width:100%; height:226px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Findex.ts%23L131-L137&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

In the snippet above, we see private fields for each kernel component, such as the `FileSystem` implementation under `#fs`, the `ProcessManager` under `#process_manager`, and the terminal controller `WrappedTerminal` under `#term`.
These components are passed into the kernel constructor, allowing for easy swapping of implementations (as seen in the Node.js port). Getters are provided to allow access to these components.

When a program is spawned, we pass the kernel instance to the program data alongside the context (arguments, process context etc). This allows the program to interact with the kernel to therefore utilise the OS functions:

<iframe frameborder="0" scrolling="no" style="width:100%; height:436px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Findex.ts%23L297-L313&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

Critically, notice the condition on `start_privileged`. By providing the `Kernel` instance as-is, the program would have full access to the kernel components via the getters, and would be able to call any method on them.
This would be kernelspace access, which we don't want to grant all programs! Therefore, if the program is not started as privileged, we create a "userspace" proxy that only exposes a limited set of methods:

<iframe frameborder="0" scrolling="no" style="width:100%; height:1024px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Findex.ts%23L551-L595&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

This looks daunting, but essentially all it does is create a new object that only exposes a limited set of methods from the kernel components. Each OS component also has a corresponding "userspace" interface that only exposes safe methods.
This means that a userspace program can only ever "see" the safe methods, and cannot call any privileged methods. A program can ask the user for elevation to access privileged methods via `kernel.request_privilege()`.
Note that because OllieOS is a single-user OS, the user is essentially the `root` user, so are free to grant or deny privilege requests as they see fit.

This design effectively simulates the ring architecture of a real operating system, while still being implemented in a high-level language.
It is however important to contrast this with a real OS. In a real OS, system calls are used to access kernel functions. These work by triggering a CPU interrupt that switches the CPU to ring 0, allowing the kernel to execute the requested function on behalf of the program.
The OllieOS design is a simplification of this, but it effectively demonstrates the concept of privilege levels and kernel/user separation.
It is additionally worth noting that a program could theoretically "export" this privileged access to other programs by passing the kernel instance around. I am currently exploring mitigations for this, such as [capability-based security provided by SES (Secure ECMAScript) compartments](https://www.npmjs.com/package/ses) which essentially cuts off access to the global scope and provides true isolation between programs.

## Programs vs processes

It is common to conflate the terms "program" and "process". I admit, I'm very guilty of using the term "running programs". However, these are not the same thing.

- A **program** is a static set of instructions stored on disk. It is the compiled executable file sitting in your file system, the recipe in a cookbook.
- A **process** is a running instance of a program. It is the program loaded into memory, with its own state and resources. It is the act of cooking the recipe from the cookbook.

When you type a command into your terminal, you're asking the OS to load the corresponding program from disk and create a new process to run it.

As a process is a dynamic entity, it needs to carry some context data as luggage to help the OS keep track of it. This is called the Process Control Block (PCB).
The kernel keeps track of a PCB for every running process, which contains information such as:
- Process ID (PID)
- Resources allocated to the process (memory, file handles etc)
- Process state (running, waiting, stopped etc)
- and more...

In the eyes of the OS, the PCB *is* the process. The OS uses the PCB to manage and schedule processes, allocating CPU time and resources as needed.

### How OllieOS implements process context

In OllieOS, the `ProcessContext` class represents the PCB for a process:

<iframe frameborder="0" scrolling="no" style="width:100%; height:514px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fprocesses.ts%23L312-L331&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

This is passed as data when a program is spawned (see previous example) which allows the program to access it.
Additionally, `ProcessContext` exposes methods such as `process.kill()`, `process.detach()`, `process.create_timeout()` etc to allow the program to manage its own process.

By forcing programs to create timeouts via the process context, OllieOS can keep track of which timeouts belong to which process, allowing it to clean them up when the process exits.
This is **arbitration**. The OS ensures that the resources allocated to a process are properly managed and cleaned up when the process exits.

Processes are overseen by the `ProcessManager` class, which keeps track of all running processes and their PCBs:

<iframe frameborder="0" scrolling="no" style="width:100%; height:142px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Fkernel%2Fprocesses.ts%23L575-L577&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

## How are processes scheduled?

We of course don't want to run just one process at a time. An operating system needs to be able to run multiple processes at once. This is called multitasking.

There are two ways to run processes at the same time:
- **Parallelism**: Running multiple processes at the same time on multiple CPU cores.
- **Concurrency**: Running multiple processes by rapidly switching between them on a single CPU core, giving the illusion of parallelism.

Most operating systems use a combination of both parallelism and concurrency to run multiple processes at once.

<figure style="text-align: center; width: 75%; margin: 1em auto;">
<img src="/assets/Parallelism_vs_concurrency.png" alt="Parallelism vs concurrency" style="max-width: 100%; height: auto;" />
<figcaption>By <a href="//commons.wikimedia.org/w/index.php?title=User:Azarboon&amp;action=edit&amp;redlink=1" class="new" title="User:Azarboon (page does not exist)">Azarboon</a> - <span class="int-own-work" lang="en">Own work</span>, <a href="https://creativecommons.org/licenses/by-sa/4.0" title="Creative Commons Attribution-Share Alike 4.0">CC BY-SA 4.0</a>, <a href="https://commons.wikimedia.org/w/index.php?curid=148794396">Link</a></figcaption>
</figure>

In terms of concurrency, the OS needs a way to decide which process to run next. This is called process scheduling. There are two main types of process scheduling:
- **Preemptive scheduling**: The OS can interrupt a running process to switch to another process. This is the most common type of scheduling used in modern operating systems. The OS uses a timer interrupt to periodically interrupt the running process and switch to another process to give each process a "fair" share of CPU time (note that time slices may not be equal depending on the scheduling algorithm used, and the amount of I/O access).
- **Cooperative scheduling**: The running process voluntarily yields control to the OS to switch to another process. This is less common, but is used in some real-time operating systems. It is simpler to implement, but can lead to issues if a process does not yield control.

### How OllieOS implements process scheduling

In browsers, we have a significant limitation: JavaScript is single-threaded. This means that we cannot run multiple processes in parallel, as we only have one "core" to work with.
Web workers do exist, but they are not suitable for this use case as they cannot share objects directly, and would require significant overhead to communicate between the main thread and worker threads.

Therefore, OllieOS uses cooperative scheduling to run multiple processes. Each process is invoked as a JavaScript Promise (async/await).
JavaScript uses an event loop to manage asynchronous execution of promises. When a promise is awaited, the event loop can switch to another promise (process) while waiting for the awaited promise to resolve.

JavaScript timeouts and intervals also use the event loop to schedule execution. When a timeout or interval is set, the event loop will schedule the callback to be executed after the specified time has elapsed, and is therefore able to switch to other promises in the meantime.
This therefore means that cooperative multitasking is achieved natively in JavaScript simply by using async/await and timeouts/intervals.

Additionally, many filesystem access methods in OllieOS are asynchronous, meaning that when a process performs file I/O, it will naturally yield control to the OS while waiting for the I/O to complete.

## How are files managed?

Finally, a computer needs a place to store and retrieve data in a structured way. This is the job of the filesystem implementation.

Storage devices are diverse and complex. As mentioned near the start of the post, different devices have different capabilities, access methods, and physical characteristics.
The instructions you give to a hard drive (spin your disk, move your head, read the magnetic data) are completely different to those you give to an SSD (access a memory cell, read the data).

If every program had to know how to talk to every type of storage device, present and future, it would be a nightmare.
Therefore, operating systems provide an abstraction layer over storage devices called the file system. The actual data storage and retrieval is delegated to device drivers, while the filesystem provides a consistent interface for programs to read and write files.
This means no matter how the hardware works, or whatever hardware will be designed in the future, programs can always use the same filesystem interface to access files.

### How OllieOS implements the filesystem

JavaScript has many ways of allowing a website to store data. In browsers, these include (but are not limited to) LocalStorage, IndexedDB, and the newer Origin Private File System (OPFS) (which is now the preferred way to store files in OllieOS for its simplicity and scalability).
Similarly, Node.js has its own filesystem API that allows access to the host machine's filesystem directly.

Therefore, OllieOS abstracts away the filesystem implementation behind an `AbstractFileSystem` interface. This is an abstract class with concrete utility methods (e.g. `absolute()` to get absolute paths) and abstract methods such as `write_file()`, `read_file()`, `delete_file()`, `make_dir()`.
Each filesystem implementation extends this abstract class and is forced to provide concrete implementations for the abstract methods.

For example, here is how checking a file exists looks for the `LocalStorageFS` implementation, where files are stored as a nested JSON structure in `localStorage`:

<iframe frameborder="0" scrolling="no" style="width:100%; height:583px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Fobfuscatedgenerated.github.io%2Fblob%2Fff30c91376bccb7cd78387a64b26fe2b9e037db2%2Fsrc%2Ffs_impl%2Flocalstorage.ts%23L415-L438&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

And in contrast, the Node.js implementation `RealFS` just uses the built-in `fs` module to check if a file exists:

<iframe frameborder="0" scrolling="no" style="width:100%; height:163px;" allow="clipboard-write" src="https://emgithub.com/iframe.html?target=https%3A%2F%2Fgithub.com%2Fobfuscatedgenerated%2Follieos_node%2Fblob%2F4905b925b62fa092827205d19db5fd17725db738%2Fsrc%2Freal_fs.ts%23L112-L115&style=github-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on"></iframe>

This demonstrates the power of abstraction. The core OllieOS kernel and programs can use the same filesystem interface, regardless of the underlying implementation. The browser or environment simply chooses the appropriate filesystem implementation when initialising the kernel.

## Conclusion

We now have a solid understanding of the core concepts of operating system architecture, and how they can be implemented in a high-level language like TypeScript.

OllieOS demonstrates that it is possible to build key components of an operating system in JavaScript, while still adhering to the fundamental principles of OS design.
We have implemented a kernel with privilege levels, process management with PCBs, cooperative multitasking using JavaScript's event loop, and an abstracted filesystem interface.

By abstracting these components, we have created a system that is logically robust, even if it runs inside a browser tab rather than on bare metal.

However, a computer that sits idle isn't very useful. We've built the internal machinery, but we are missing the input/output layer, as well as the essential userspace infrastructure such as init systems and shells. We have a machine that can think, but it has no way to talk to us.

In part 2, we will explore how these are implemented, first discussing the **boot sequence** to follow the lifecycle of an OS from boot to running user programs, and then focusing on **terminal control** to allow user interaction.
Stay tuned!

(will be linked here when published)

---

**A note on educational use**: You are welcome to adapt the concepts and explanations in this post for teaching purposes, provided you attribute me following the citations below.

However, please note that the OllieOS codebase is **proprietary and strictly copyrighted**. You may **not** use, copy, modify, or distribute the code itself.

### Plaintext (APA Style)

Ollie G. (2026, January 29). *Operating System Fundamentals with TypeScript (Part 1): The Kernel, Scheduler, and Filesystem*. Retrieved from [https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html](https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html)

### Markdown

```markdown
Ollie G. (2026). *Operating System Fundamentals with TypeScript (Part 1): The Kernel, Scheduler, and Filesystem*. Retrieved from https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html
```

### HTML

```html
<p>
  Ollie G. (2026). <em>Operating System Fundamentals with TypeScript (Part 1): The Kernel, Scheduler, and Filesystem</em>. 
  Retrieved from <a href="https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html">https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html</a>
</p>
```

### BibTeX

```bibtex
@misc{ollieg2026buildingos1,
  author = {G, Ollie},
  title = {Operating System Fundamentals with TypeScript (Part 1): The Kernel, Scheduler, and Filesystem},
  year = {2026},
  month = {January},
  day = {29},
  url = {https://blog.ollieg.codes/2026/01/29/building-an-os-pt1.html},
  note = {Accessed: 2026-01-29}
}
```
