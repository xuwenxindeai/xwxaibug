# 🌐 外部访问指南

## ✅ 配置已完成

服务器已配置为监听所有网络接口（0.0.0.0），外部设备可以访问了！

## 📍 访问地址

### 在同一局域网内的其他电脑上，使用以下地址访问：

```
http://192.168.0.182:3000
```

或

```
http://192.168.127.199:3000
```

### 说明：
- **en9 (192.168.0.182)** - 可能是有线网络或 USB 网络
- **en0 (192.168.127.199)** - 可能是 Wi-Fi 网络
- **utun5 (10.105.13.20)** - VPN 网络（外部无法访问）

## 🔍 确定使用哪个 IP

1. **如果两台电脑在同一 Wi-Fi 下** → 使用 `192.168.127.199`
2. **如果通过有线连接** → 使用 `192.168.0.182`
3. **如果不确定** → 两个都试试

## 🧪 测试连接

在另一台电脑上打开终端或浏览器：

### 方法 1: 浏览器访问
直接打开：http://192.168.0.182:3000

### 方法 2: 命令行测试
```bash
# 测试连接
curl http://192.168.0.182:3000/api/stats

# 如果成功，会返回 JSON 数据
```

## ⚠️ 如果无法访问

### 1. 检查防火墙

在 Mac 上打开防火墙设置：
```
系统设置 → 网络 → 防火墙
```

临时关闭防火墙测试，或添加 Node.js 到允许列表。

### 2. 使用命令行开启防火墙端口

```bash
# 查看防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 临时关闭防火墙（测试用）
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# 重新开启防火墙
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

### 3. 检查两台电脑是否在同一网络

在两台电脑上分别运行：
```bash
# Mac/Linux
ping 192.168.0.182

# Windows
ping 192.168.0.182
```

如果能 ping 通，说明网络连通。

### 4. 检查服务是否运行

在这台 Mac 上运行：
```bash
curl http://localhost:3000/api/stats
```

如果返回数据，说明服务正常。

## 📱 手机访问

如果手机和 Mac 在同一 Wi-Fi 下：

1. 手机连接同一 Wi-Fi
2. 打开手机浏览器
3. 访问：http://192.168.127.199:3000

## 🔐 安全提示

⚠️ **当前配置仅在局域网内安全**

- ✅ 家庭/公司内网：安全
- ❌ 直接暴露在公网：危险

### 如需外网访问，建议：

1. **使用内网穿透工具**（如 ngrok、frp）
2. **配置反向代理**（如 Nginx + HTTPS）
3. **添加身份验证**（用户名密码）

## 🚀 快速测试脚本

在另一台电脑上运行：

```bash
#!/bin/bash
# 保存为 test-access.sh

IP="192.168.0.182"
PORT="3000"

echo "🧪 测试连接到 AIBug 平台..."
echo "地址：http://$IP:$PORT"
echo ""

# 测试连接
if curl -s --connect-timeout 5 "http://$IP:$PORT/api/stats" > /dev/null; then
    echo "✅ 连接成功！"
    echo ""
    echo "📊 统计信息:"
    curl -s "http://$IP:$PORT/api/stats" | python3 -m json.tool 2>/dev/null || curl -s "http://$IP:$PORT/api/stats"
else
    echo "❌ 连接失败"
    echo ""
    echo "请检查:"
    echo "1. 两台电脑是否在同一网络"
    echo "2. 防火墙是否阻止了端口 3000"
    echo "3. 服务是否正常运行"
fi
```

## 📞 需要帮助？

如果还是无法访问，告诉我：
1. 另一台电脑的操作系统（Windows/Mac/Linux）
2. 两台电脑的连接方式（Wi-Fi/有线）
3. 具体的错误信息

我会帮你解决！🔧
