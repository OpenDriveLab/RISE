# 访客统计使用说明

## 📊 关于访客统计

本站使用 **不蒜子（Busuanzi）** 统计服务，可以统计**所有访客**的真实访问数据。

## 🔍 如何查看访客统计

### 方法 1：点击按钮
点击网页**左下角**的隐蔽 **📊 图标**（半透明，悬停时会显示）

### 方法 2：快捷键（推荐）
按 **Ctrl + Shift + S** (Mac 用户按 Cmd + Shift + S)

### 输入密码
默认密码：**rise123**

## ⚠️ 重要提示

### 部署后看不到数据？试试这些方法！

**方法 1：耐心等待（最常见）**
- 不蒜子加载需要 **30秒-1分钟**
- 刷新页面后重新打开统计面板
- 点击面板的 **🔄 刷新** 按钮

**方法 2：检查网络**
- 确保能访问 `busuanzi.ibruce.info`
- 有些网络可能屏蔽不蒜子
- 尝试用手机4G网络测试

**方法 3：等待积累数据**
- 第一次访问可能显示 `1` 或 `--`
- 多刷新几次页面（不打开统计面板）
- 过几分钟再查看

**方法 4：清空缓存重试**
```
Ctrl + Shift + Delete → 清空缓存 → 刷新页面
```

## 📈 统计内容

- 🌐 **本站总访问量** - 整个网站所有页面的访问次数（PV）
- 👥 **本站访客数** - 访问网站的独立用户数（UV）
- 📄 **本页访问量** - 当前页面的访问次数

## 🔐 修改密码

编辑文件：`assets/js/main.js` 第 **1088** 行

```javascript
const OWNER_PASSWORD = "rise123";  
```

## 💡 说明

- ✅ 使用不蒜子服务，数据**所有人共享**
- ✅ 统计全网访客的真实访问量
- ✅ 只有你（输入密码）能看到统计数据
- ✅ 访客看不到统计，不影响页面显示
- ✅ 完全免费，无需注册

## 🚀 如何部署（让统计生效）

### 方法 1：GitHub Pages
```bash
git add .
git commit -m "add visitor stats"
git push origin main
```
然后在 GitHub 仓库设置中开启 Pages

### 方法 2：其他服务器
上传到任何支持静态网页的服务器即可

**部署后访问网站，统计数据就会正常显示！**

## 🔧 故障排除

### 如果不蒜子一直不显示数据

打开浏览器开发者工具（F12），在 Console 检查：

```javascript
// 检查不蒜子是否加载
console.log(typeof busuanzi)  // 应该显示 'object'

// 手动查看数据
console.log(document.getElementById('busuanzi_value_site_pv').textContent)
```

### 备用方案：使用 Google Analytics

如果不蒜子不稳定，可以换用 Google Analytics：

1. 访问 [Google Analytics](https://analytics.google.com/)
2. 创建账号并获取跟踪 ID
3. 在 `index.html` 的 `<head>` 中添加跟踪代码
4. 在 Google Analytics 后台查看详细统计

## 📝 其他

- **关闭面板**：点击"关闭"按钮
- **刷新数据**：点击"🔄 刷新"按钮
- **查看原始数据**：访问 [不蒜子官网](http://busuanzi.ibruce.info/)

---

**提示**：不蒜子是免费服务，偶尔会不稳定。如需更稳定的统计，建议使用 Google Analytics 或百度统计等专业服务。

就这么简单！😊
