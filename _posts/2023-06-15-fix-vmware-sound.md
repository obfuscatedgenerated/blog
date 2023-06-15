---
layout: post_tagged
title: "Fixing Windows 2000/XP sound issues in VMware Workstation for Windows 10/11"
subtitle: "A solution to the sound issues that actually works (as of posting), no magic tools required!"
date: 2023-06-15 14:38:00
background: "/assets/futuristic_board_header-min.jpg"
tags: windows virtual_machines tips
---

**TLDR: You need to disable virtualisation based security on the host using [this command](#command).**

---

## The problem

Recently, I've been playing around with VMware Workstation 17 using Windows XP, but I found that the sound is laggy and slow, as well as the system being slow in general. This is because of a feature called "Virtualisation Based Security" (VBS) that was introduced in Windows 10. This is a security feature designed to protect the kernel from malicious code, but it has the side effect of forcing VM software to use a slower virtualisation method.

---

## The solution

The solution is to disable VBS on the host machine, which can be done using the following command:

<a name="command"></a>

```shell
bcdedit /set hypervisorlaunchtype off
```

You will need to reboot your computer for this to take effect.<br />
Now the blissful sounds of Windows XP will be restored!

---

To re-enable VBS, use the following command and reboot:

<a name="revert-command"></a>

```shell
bcdedit /set hypervisorlaunchtype auto
```

---

## The catch

This also disables Windows' built-in virtualisation features on the host, which means:

- (possibly) Lower security against advanced malware attacks
- No WSL2
- Other features such as Hyper-V may not work

You can easily re-enable VBS using [the command above](#revert-command), but you will need to reboot your computer again.
