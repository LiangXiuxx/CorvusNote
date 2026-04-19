import React, { useState, useRef, useEffect } from 'react'
import '../styles/HomePage.css'
import { DEFAULT_PERSONAL_KNOWLEDGE_BASES } from '../utils/defaultKnowledgeBases'

function HomePage({ onSendQuestion, user, onLogout, onShowSettings, onGoToKnowledgeBase, onGoToSharedKnowledgeBase, onGoToConversations, onGoToNotes, onGoToAdminPage, models, selectedModel, onModelChange }) {
  const [question, setQuestion] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const formRef = useRef(null)
  
  // 知识库相关状态
  const [showKnowledgeBasePicker, setShowKnowledgeBasePicker] = useState(false)
  const [mountedKnowledgeBases, setMountedKnowledgeBases] = useState([])
  
  // 设置菜单相关状态
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (question.trim() || selectedFile) {
      onSendQuestion(question.trim(), selectedFile, mountedKnowledgeBases)
      setQuestion('')
      setSelectedFile(null)
      setMountedKnowledgeBases([])
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }
  
  // 加载知识库数据（读取与 KnowledgeBasePage 一致的 key）
  const loadKnowledgeBaseData = () => {
    if (user) {
      const savedData = localStorage.getItem(`corvusNotePersonalKnowledgeBase_${user.id}`)
      if (savedData) return JSON.parse(savedData)
    }
    // 默认：CorvusNote 使用指南（与 KnowledgeBasePage 默认数据保持一致）
    return DEFAULT_PERSONAL_KNOWLEDGE_BASES
  }

  // 递归获取文件夹内所有文件
  const getAllFiles = (items, result = []) => {
    for (const item of items) {
      if (item.type === 'folder' && item.items) {
        getAllFiles(item.items, result)
      } else if (item.type !== 'folder') {
        result.push(item)
      }
    }
    return result
  }

  // 获取顶层展示项（文件夹 + 文件都显示）
  const getPickerItems = (items) => items || []

  // 处理@符号点击
  const handleAtClick = () => {
    setShowKnowledgeBasePicker(!showKnowledgeBasePicker)
  }

  // 处理知识库挂载：文件直接挂载，文件夹直接挂载整个文件夹
  const handleMountKnowledgeBase = (item) => {
    setMountedKnowledgeBases(prev => {
      if (!prev.some(m => m.id === item.id)) return [...prev, item]
      return prev
    })
    setShowKnowledgeBasePicker(false)
  }
  
  // 处理知识库卸载
  const handleUnmountKnowledgeBase = (fileId) => {
    setMountedKnowledgeBases(prev => prev.filter(item => item.id !== fileId))
  }
  
  // 监听文档点击，点击空白处关闭知识库选择器、设置菜单和移除输入框焦点
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showKnowledgeBasePicker) {
        const picker = document.querySelector('.knowledge-base-picker');
        const atBtn = document.querySelector('.at-button');
        if (picker && !picker.contains(event.target) && atBtn && !atBtn.contains(event.target)) {
          setShowKnowledgeBasePicker(false);
        }
      }
      
      if (showSettingsMenu) {
        const settingsMenu = document.querySelector('.settings-menu');
        const settingsBtn = document.querySelector('.settings-btn');
        if (settingsMenu && !settingsMenu.contains(event.target) && settingsBtn && !settingsBtn.contains(event.target)) {
          setShowSettingsMenu(false);
        }
      }
      
      // 点击其他区域移除输入框焦点
      if (isInputFocused && formRef.current && !formRef.current.contains(event.target)) {
        setIsInputFocused(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showKnowledgeBasePicker, showSettingsMenu, isInputFocused])

  return (
    <div className="home-page">
      <div className="side-bar">
        <div className="logo">
          <div className="raven-icon"></div>
        </div>
        <div className="nav-items">
          <div 
            className="nav-item"
            onClick={onGoToConversations}
          >
            <span className="nav-icon">
              <svg t="1770274551851" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5875" width="24" height="24"><path d="M512 95.203556c239.872 0 435.2 152.775111 435.2 340.679111C947.2 623.758222 751.872 776.533333 512 776.533333a155.306667 155.306667 0 0 0-55.552 11.776 866.986667 866.986667 0 0 0-179.2 111.900445c-4.864-144.384-25.6-190.236444-61.696-215.665778C128 620.373333 76.8 529.692444 76.8 436.138667 76.8 247.978667 272.128 95.459556 512 95.459556v-0.284445z m0-78.364445C230.4 16.839111 0 204.515556 0 436.138667c0 124.216889 65.792 235.861333 170.752 312.632889 25.6 18.858667 30.464 131.043556 30.464 216.462222-0.199111 12.288 4.380444 24.177778 12.714667 33.024 8.362667 8.846222 19.797333 13.937778 31.829333 14.136889 9.329778-0.369778 18.289778-3.754667 25.6-9.671111 64.256-50.858667 155.904-118.727111 211.2-140.231112a79.843556 79.843556 0 0 1 29.44-6.826666c281.6 0 512-187.875556 512-419.271111S793.6 17.123556 512 17.123556v-0.284445z m166.4 312.632889h-332.8c-21.219556 0-38.4 17.607111-38.4 39.310222 0 21.703111 17.180444 39.310222 38.4 39.310222h332.8c21.219556 0 38.4-17.607111 38.4-39.310222 0-21.703111-17.180444-39.310222-38.4-39.310222z m-51.2 183.466667h-230.4c-21.219556 0-38.4 17.578667-38.4 39.281777 0 21.731556 17.180444 39.310222 38.4 39.310223h230.4c21.219556 0 38.4-17.578667 38.4-39.310223 0-21.703111-17.180444-39.310222-38.4-39.310222z" fill="#000000" p-id="5876"></path></svg>
            </span>
          </div>
          <div 
            className="nav-item"
            onClick={onGoToNotes}
          >
            <span className="nav-icon">
              <svg t="1770274663436" className="icon" viewBox="0 0 1025 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6026" width="24" height="24"><path d="M982.492729 997.546667H44.224284a42.666667 42.666667 0 1 1 0-85.276445h938.268445a42.666667 42.666667 0 0 1 0 85.304889zM154.674062 846.620444a85.304889 85.304889 0 0 1-81.891555-62.264888 81.464889 81.464889 0 0 1 0-47.331556l56.746666-178.716444a42.666667 42.666667 0 0 1 10.24-16.611556l192.341334-200.874667L634.048284 38.4a127.943111 127.943111 0 0 1 180.849778 0l60.558222 60.586667a127.943111 127.943111 0 0 1 0 180.792889L573.490062 581.319111l-192.768 200.448a42.666667 42.666667 0 0 1-19.626666 11.52l-183.808 49.891556a80.611556 80.611556 0 0 1-22.613334 3.413333z m52.053334-253.326222l-52.053334 168.021334 172.743111-47.331556L513.358507 521.614222l170.609777-172.743111-119.011555-118.983111-170.581333 170.609778-187.676445 192.768zM625.486507 167.623111l120.718222 120.689778L814.869618 219.648a42.666667 42.666667 0 0 0 0-60.558222L754.738062 98.986667a42.666667 42.666667 0 0 0-60.558222 0l-68.664889 68.664889z" fill="#000000" p-id="6027"></path></svg>
            </span>
          </div>
          <div 
            className="nav-item"
            onClick={onGoToKnowledgeBase}
          >
            <span className="nav-icon">
              <svg t="1771390517311" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4696" width="24" height="24"><path d="M139.661795 93.098382c-25.742144 0-46.563413 20.82127-46.563413 46.534969v651.631787c0 25.713699 20.82127 46.534969 46.534969 46.534969h176.355017c45.937637 0 90.851278 13.624847 129.080494 39.110991L511.998436 921.511851l66.929573-44.600753a232.731733 232.731733 0 0 1 129.023606-39.110991h176.411905c25.713699 0 46.534969-20.82127 46.534969-46.534969V139.633351c0-25.713699-20.82127-46.534969-46.534969-46.534969h-176.355017c-19.342163 0-48.753629 8.362641-73.557108 22.812375-12.003519 6.968868-20.650604 14.079957-25.770588 19.996383a26.168809 26.168809 0 0 0-3.726211 5.262206v556.99741a46.534969 46.534969 0 0 1-93.098382 0V139.661795c0-26.993695 12.942183-49.066517 26.396364-64.597135a194.929182 194.929182 0 0 1 49.493182-39.651435C623.016763 14.904843 668.442402 0 707.980059 0h176.355017A139.661795 139.661795 0 0 1 1023.996871 139.661795v651.603343a139.661795 139.661795 0 0 1-139.661795 139.661795h-176.355017a139.661795 139.661795 0 0 0-77.425541 23.438151l-92.728606 61.809589a46.534969 46.534969 0 0 1-51.654953 0l-92.728606-61.809589a139.661795 139.661795 0 0 0-77.453985-23.466595h-176.355017A139.661795 139.661795 0 0 1 0 791.265138V139.633351A139.661795 139.661795 0 0 1 139.661795 0h176.355017c45.909193 0 90.822834 13.624847 129.05205 39.110992a46.534969 46.534969 0 0 1-51.626509 77.425541 139.661795 139.661795 0 0 0-77.453985-23.438151h-176.355017z" fill="#000000" p-id="4697"></path><path d="M170.666145 360.304677C170.666145 334.135868 191.032305 312.887933 216.177117 312.887933h136.532916c25.144812 0 45.510972 21.219491 45.510972 47.416744 0 26.168809-20.36616 47.3883-45.510972 47.388299H216.177117c-25.144812 0-45.510972-21.219491-45.510972-47.388299z m45.510972 189.610087c0-12.572406 4.807096-24.632814 13.340404-33.507453 8.533307-8.903084 20.110161-13.880846 32.170568-13.880846h91.021944c25.144812 0 45.510972 21.219491 45.510972 47.388299 0 26.168809-20.36616 47.416744-45.510972 47.416744H261.688089c-25.144812 0-45.510972-21.219491-45.510972-47.416744z" fill="#000000" p-id="4698"></path></svg>
            </span>
          </div>
          <div 
            className="nav-item"
            onClick={onGoToSharedKnowledgeBase}
          >
            <span className="nav-icon">
              <svg t="1770886709585" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6625" width="24" height="24"><path d="M512 93.098667A418.901333 418.901333 0 0 0 101.461333 595.825778a46.535111 46.535111 0 0 1-91.221333 18.517333C3.413333 580.664889 0 546.360889 0 512 0 229.262222 229.262222 0 512 0c96.341333 0 186.652444 26.680889 263.623111 73.016889 36.266667-21.902222 69.888-38.769778 99.157333-48.583111 17.863111-6.001778 36.693333-10.24 54.784-10.012445 18.375111 0.227556 40.305778 5.262222 57.514667 22.471111 17.237333 17.237333 22.272 39.168 22.471111 57.543112 0.256 18.119111-3.982222 36.920889-9.984 54.840888-9.784889 29.212444-26.680889 62.833778-48.583111 99.100445A509.809778 509.809778 0 0 1 1024 512c0 282.737778-229.262222 512-512 512-96.341333 0-186.652444-26.680889-263.623111-73.016889-36.266667 21.902222-69.888 38.769778-99.157333 48.583111-17.863111 6.001778-36.693333 10.24-54.784 10.012445-18.346667-0.227556-40.305778-5.262222-57.514667-22.471111-17.237333-17.237333-22.272-39.168-22.471111-57.543112-0.256-18.147556 3.982222-36.920889 9.984-54.840888 12.117333-35.982222 34.872889-78.648889 64.597333-124.700445 65.706667-101.603556 172.373333-230.115556 301.624889-359.367111 104.220444-104.220444 207.872-193.678222 297.415111-258.872889A417.194667 417.194667 0 0 0 512 93.098667z m392.334222 19.598222c-25.287111 8.448-60.359111 26.510222-103.765333 54.528-94.464 61.070222-217.827556 163.015111-344.092445 289.251555-126.236444 126.293333-228.181333 249.656889-289.251555 344.092445-28.017778 43.406222-46.08 78.506667-54.528 103.765333-1.223111 3.697778-2.190222 7.025778-2.929778 9.898667 2.872889-0.739556 6.172444-1.706667 9.898667-2.958222 25.287111-8.419556 60.359111-26.481778 103.765333-54.471111a46.535111 46.535111 0 0 1 51.655111 0.711111A416.768 416.768 0 0 0 512 930.901333c231.367111 0 418.901333-187.534222 418.901333-418.901333a416.768 416.768 0 0 0-73.386666-236.942222 46.535111 46.535111 0 0 1-0.739556-51.626667c28.017778-43.406222 46.08-78.506667 54.528-103.765333 1.223111-3.697778 2.190222-7.025778 2.929778-9.898667a142.791111 142.791111 0 0 0-9.898667 2.929778z" fill="#000000" p-id="6626"></path><path d="M583.111111 601.400889a67.043556 67.043556 0 1 0 0 134.087111 67.043556 67.043556 0 0 0 0-134.087111zM426.666667 668.444444a156.444444 156.444444 0 1 1 312.888889 0 156.444444 156.444444 0 0 1-312.888889 0z" fill="#000000" p-id="6627"></path></svg>
            </span>
          </div>
        </div>
        <div className="settings-section">
          <div 
            className="settings-btn"
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
          >
            <svg t="1770613956649" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2993" width="24" height="24"><path d="M634.424889 994.133333h-244.849778a267.406222 267.406222 0 0 1-231.310222-134.485333l-122.595556-213.873778a270.961778 270.961778 0 0 1 0-268.686222l122.595556-213.873778a267.576889 267.576889 0 0 1 231.310222-134.485333h244.707556a267.406222 267.406222 0 0 1 231.310222 134.485333l122.595555 213.873778a270.961778 270.961778 0 0 1 0 268.686222l-122.595555 213.873778a267.178667 267.178667 0 0 1-231.168 134.485333zM231.594667 817.038222a182.755556 182.755556 0 0 0 157.980444 91.875556h244.707556a182.584889 182.584889 0 0 0 157.980444-91.875556l122.567111-213.873778a185.400889 185.400889 0 0 0 0-183.608888l-122.595555-213.902223A182.755556 182.755556 0 0 0 634.311111 113.777778h-244.707555a182.584889 182.584889 0 0 0-157.980445 91.875555l-122.567111 213.902223a185.400889 185.400889 0 0 0 0 183.608888l122.595556 213.902223zM512 729.998222c-119.751111 0-217.201778-98.133333-217.201778-218.709333S392.248889 292.579556 512 292.579556s217.201778 98.133333 217.201778 218.709333S631.751111 729.998222 512 729.998222z m0-352.199111c-73.073778 0-132.579556 59.932444-132.579556 133.489778 0 73.557333 59.505778 133.489778 132.579556 133.489778 73.073778 0 132.579556-59.932444 132.579556-133.489778 0-73.557333-59.505778-133.489778-132.579556-133.489778z" fill="#000000" p-id="2994"></path></svg>
          </div>
          {showSettingsMenu && (
            <div className="settings-menu">
              <div 
                className="settings-menu-item"
                onClick={onShowSettings}
              >
                <svg t="1770613956649" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2993" width="16" height="16"><path d="M634.424889 994.133333h-244.849778a267.406222 267.406222 0 0 1-231.310222-134.485333l-122.595556-213.873778a270.961778 270.961778 0 0 1 0-268.686222l122.595556-213.873778a267.576889 267.576889 0 0 1 231.310222-134.485333h244.707556a267.406222 267.406222 0 0 1 231.310222 134.485333l122.595555 213.873778a270.961778 270.961778 0 0 1 0 268.686222l-122.595555 213.873778a267.178667 267.178667 0 0 1-231.168 134.485333zM231.594667 817.038222a182.755556 182.755556 0 0 0 157.980444 91.875556h244.707556a182.584889 182.584889 0 0 0 157.980444-91.875556l122.567111-213.873778a185.400889 185.400889 0 0 0 0-183.608888l-122.595555-213.902223A182.755556 182.755556 0 0 0 634.311111 113.777778h-244.707555a182.584889 182.584889 0 0 0-157.980445 91.875555l-122.567111 213.902223a185.400889 185.400889 0 0 0 0 183.608888l122.595556 213.902223zM512 729.998222c-119.751111 0-217.201778-98.133333-217.201778-218.709333S392.248889 292.579556 512 292.579556s217.201778 98.133333 217.201778 218.709333S631.751111 729.998222 512 729.998222z m0-352.199111c-73.073778 0-132.579556 59.932444-132.579556 133.489778 0 73.557333 59.505778 133.489778 132.579556 133.489778 73.073778 0 132.579556-59.932444 132.579556-133.489778 0-73.557333-59.505778-133.489778-132.579556-133.489778z" fill="#000000" p-id="2994"></path></svg>
                <span>系统设置</span>
              </div>
              {user.is_admin && (
                <div 
                  className="settings-menu-item"
                  onClick={onGoToAdminPage}
                >
                  <svg t="1771332562714" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4542" width="16" height="16"><path d="M512 104.106667c-149.674667 0-287.943111 77.653333-362.780444 203.776a398.08 398.08 0 0 0 0 407.608889c74.808889 126.094222 213.105778 203.776 362.780444 203.776 231.367111 0 418.901333-182.499556 418.901333-407.608889C930.901333 286.606222 743.367111 104.106667 512 104.106667zM0 511.658667C0 236.544 229.262222 13.511111 512 13.511111S1024 236.544 1024 511.715556c0 275.114667-229.262222 498.147556-512 498.147555S0 786.801778 0 511.715556z" fill="#000000" p-id="4543"></path><path d="M526.222222 685.340444c-106.012444 0-180.167111 34.929778-226.076444 66.816a45.767111 45.767111 0 0 1-46.08 4.295112 45.966222 45.966222 0 0 1-6.200889-79.843556c58.794667-40.931556 150.869333-83.228444 278.357333-83.228444 127.488 0 219.591111 42.353778 278.357334 83.228444a46.023111 46.023111 0 0 1-6.200889 79.843556 45.767111 45.767111 0 0 1-46.08-4.295112c-45.852444-31.857778-120.007111-66.844444-226.076445-66.844444z m0-229.888a91.847111 91.847111 0 0 1-91.704889-91.960888A91.847111 91.847111 0 0 1 526.222222 271.530667a91.847111 91.847111 0 0 1 91.704889 91.960889 91.847111 91.847111 0 0 1-91.704889 91.960888z m-183.438222-91.960888c0 101.546667 82.119111 183.921778 183.438222 183.921777s183.438222-82.346667 183.438222-183.921777-82.119111-183.921778-183.438222-183.921778-183.438222 82.346667-183.438222 183.921778z" fill="#000000" p-id="4544"></path></svg>
                  <span>管理员控制台</span>
                </div>
              )}
              <div 
                className="settings-menu-item"
                onClick={() => {
                  if (window.confirm('确定要退出登录吗？')) {
                    onLogout()
                  }
                }}
              >
                <svg t="1770614157446" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3146" width="16" height="16"><path d="M499.456045 1023.996302a469.331639 469.331639 0 0 1-179.626018-903.250071 42.666513 42.666513 0 0 1 55.893132 23.466582 42.666513 42.666513 0 0 1-23.039917 55.466466 383.998613 383.998613 0 0 0-237.22581 354.985385 383.998613 383.998613 0 1 0 655.357633-271.35902 378.878632 378.878632 0 0 0-124.586216-85.333026 42.666513 42.666513 0 0 1-23.039917-55.466466 42.666513 42.666513 0 0 1 55.893131-23.466582 469.331639 469.331639 0 0 1 152.31945 101.972965A469.331639 469.331639 0 0 1 499.456045 1023.996302z m0-597.331176a42.666513 42.666513 0 0 1-42.666512-42.666513v-341.3321a42.666513 42.666513 0 1 1 85.333025 0v341.3321a42.666513 42.666513 0 0 1-42.666513 42.666513z" fill="#000000" p-id="3147"></path></svg>
                <span>退出登录</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="main-content">
        <div className="app-info">
          <h1 className="app-name">Corvus Note</h1>
        </div>
        
        {/* 挂载的知识库显示 */}
      {mountedKnowledgeBases.length > 0 && (
        <div className="mounted-knowledge-bases">
          <div className="mounted-title">已挂载知识库:</div>
          <div className="mounted-list">
            {mountedKnowledgeBases.map(file => (
              <div key={file.id} className="mounted-item">
                <span className="mounted-file-name">{file.name}</span>
                <button 
                  className="unmount-btn"
                  onClick={() => handleUnmountKnowledgeBase(file.id)}
                  title="卸载知识库"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <form className="question-form" onSubmit={handleSubmit} ref={formRef} onClick={() => setIsInputFocused(true)}>
          <div className={`input-container ${isInputFocused ? 'focused' : ''}`}>
            <div className="input-wrapper">
              <div className="input-with-at">
                <input
                  type="text"
                  className="question-input"
                  ref={inputRef}
                  placeholder="有问题尽管问Corvus"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  autoFocus
                />
              </div>
              
              {/* 知识库选择器 */}
              {showKnowledgeBasePicker && (
                <div className="knowledge-base-picker">
                  <div className="picker-header">选择知识库</div>
                  <div className="picker-content">
                    {(() => {
                      const items = getPickerItems(loadKnowledgeBaseData())
                      return items.length > 0 ? (
                        items.map(item => (
                          <div
                            key={item.id}
                            className="knowledge-base-item"
                            onClick={() => handleMountKnowledgeBase(item)}
                          >
                            <span className="knowledge-base-icon">
                              {item.type === 'folder' ? '📁' :
                               item.type === 'pdf' ? '📄' :
                               item.type === 'word' ? '📝' : '📄'}
                            </span>
                            <span className="knowledge-base-name">{item.name}</span>
                            <span className="knowledge-base-size">
                              {item.type === 'folder'
                                ? `${getAllFiles([item]).length} 个文件`
                                : item.size}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="no-knowledge-base">
                          <div className="no-knowledge-base-icon">📚</div>
                          <div className="no-knowledge-base-text">暂无知识库文件</div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
              
              <div className="input-actions">
                  {/* 左侧：模型选择 */}
                  <div className="left-actions">
                    <select
                      className="model-select"
                      value={selectedModel}
                      onChange={(e) => onModelChange(e.target.value)}
                    >
                      {models.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>

                {/* 中间：显示已选择的文件名 */}
                <div className="middle-actions">
                  {selectedFile && (
                    <div className="selected-file-name">
                      {selectedFile.name}
                    </div>
                  )}
                </div>
                
                {/* 右侧：功能按钮 */}
                <div className="right-actions">
                  {/* @符号按钮 */}
                  <button 
                    type="button" 
                    className="at-button"
                    onClick={handleAtClick}
                    title="选择知识库"
                  >
                    @
                  </button>
                  
                  {/* 附件上传按钮 */}
                  <button 
                    type="button" 
                    className="at-button"
                    onClick={handleAttachClick}
                    title="上传附件"
                  >
                    <svg t="1768785471395" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M633.553 251.102c15.993-12.795 38.385-12.795 55.978 1.6 15.993 15.993 15.993 38.384 0 54.378L347.264 647.747c-22.39 20.792-22.39 57.577 0 81.568 20.792 22.391 57.578 22.391 81.568 0l401.444-403.042c55.978-55.979 55.978-148.742 0-204.72s-148.742-55.979-204.72 0l-47.982 47.98-12.795 12.796-369.455 369.455c-91.165 91.165-91.165 236.708 0 327.872 91.164 91.165 236.707 91.165 327.872 0L894.25 511.8c6.397-3.199 9.596-7.997 12.795-12.795 15.993-15.994 38.385-15.994 54.378 0s15.994 38.385 0 54.379l-3.198 3.199c-3.2 1.599-6.398 6.397-9.597 9.596L577.574 934.035c-119.953 119.953-316.676 119.953-436.63 0s-119.952-316.676 0-436.63l430.233-431.83c86.366-86.367 227.111-86.367 315.077 0 86.366 86.366 86.366 227.11 0 315.076L483.21 783.694c-52.78 52.78-139.145 52.78-190.325 0-52.78-52.78-52.78-139.146 0-190.326l340.667-342.266z m0 0" fill="#000000" p-id="5381"></path></svg>
                  </button>
                  
                  {/* 隐藏的文件输入控件 */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md"
                  />
                  
                  {/* 发送按钮 */}
                  <button type="submit" className="send-button">
                    <svg t="1770622316922" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3911" width="20" height="20"><path d="M1014.288782 129.308444a42.666667 42.666667 0 0 1 5.802667 45.141334L715.024782 829.610667a42.666667 42.666667 0 0 1-63.146666 16.952889l-234.666667-163.783112a42.666667 42.666667 0 0 1 48.839111-69.973333l193.024 134.741333 245.902222-528.099555L146.875449 408.462222l156.814222 104.248889a42.666667 42.666667 0 0 0 45.056 1.336889l235.719111-137.073778a42.666667 42.666667 0 1 1 42.922667 73.756445l-235.719111 137.102222a128 128 0 0 1-135.253334-4.039111L19.131449 425.984a42.666667 42.666667 0 0 1 13.312-76.942222l938.666667-233.984a42.666667 42.666667 0 0 1 43.207111 14.250666h-0.056889z" fill="#ffffff" p-id="3912"></path><path d="M481.439004 686.876444a42.666667 42.666667 0 0 1 1.934223 60.302223l-153.514667 163.783111A42.666667 42.666667 0 0 1 256.045227 881.777778v-163.811556a42.666667 42.666667 0 1 1 85.333333 0v55.893334l79.786667-85.048889a42.666667 42.666667 0 0 1 60.302222-1.934223z" fill="#ffffff" p-id="3913"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
        

      </div>
      
      <div className="user-actions">
        <div className="user-info">
          <img 
            src={user.avatar} 
            alt={user.username} 
            className="user-avatar"
          />
          <span className="username">{user.username}</span>
        </div>
      </div>
    </div>
  )
}

export default HomePage
