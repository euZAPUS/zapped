// Offensive / defensive security vocabulary.
export const cyberWords: string[] = `
nmap payload kerberos iptables exploit shellcode reverse-shell bind-shell metasploit meterpreter msfvenom
burpsuite wireshark tcpdump netcat nc ncat socat hydra john hashcat sqlmap nikto gobuster ffuf dirb wfuzz
enum4linux smbclient crackmapexec bloodhound mimikatz impacket responder ettercap aircrack-ng airodump-ng
privesc sudo suid sgid setuid capabilities cron crontab systemd passwd shadow /etc/passwd /etc/shadow
lateral pivot tunnel proxychains chisel ligolo portforward ssh-keygen authorized_keys sshd openssh
sqli xss csrf ssrf xxe rce lfi rfi idor ssti deserialization sanitize escape payloads polyglot
cve cvss owasp mitre att&ck ioc ttp apt c2 beacon implant dropper loader obfuscation packer
firewall ids ips siem soc edr xdr honeypot sandbox quarantine forensics volatility autopsy yara snort suricata
encryption cipher aes rsa sha256 md5 bcrypt argon2 salt pepper nonce hmac jwt oauth saml ldap kerberoasting
asreproast golden-ticket silver-ticket pass-the-hash pass-the-ticket dcsync ntlm ntlmv2 netntlm krbtgt
subnet netmask gateway dns dhcp arp icmp tcp udp syn ack rst fin handshake spoofing sniffing mitm
bruteforce wordlist rockyou dictionary rainbow-table credential stuffing phishing vishing smishing pretext
buffer-overflow stack heap canary aslr nx pie rop gadget ret2libc format-string fuzzing afl gdb pwndbg ghidra radare2
objdump strings ltrace strace readelf checksec nm xxd hexdump base64 rot13 openssl gpg
`.split(/\s+/).filter(Boolean);

// Commands typed as a unit (they expand into several words).
export const cyberPhrases: string[] = [
  'nmap -sV -sC -p- -T4 -oN',
  'nmap -sS -Pn --script vuln',
  'iptables -A INPUT -j DROP',
  'curl -X POST -d @payload.json',
  'ssh -L 8080:localhost:80',
  'chmod +x exploit.py',
  'python3 -m http.server',
  'sudo -l',
  'find / -perm -4000 2>/dev/null',
];
