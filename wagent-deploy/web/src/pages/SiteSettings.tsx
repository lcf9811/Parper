import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Radio, Upload, message, Space, Divider, Typography, Row, Col, Image } from 'antd';
import { UploadOutlined, GlobalOutlined, InfoCircleOutlined, FileImageOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { TextArea } = Input;

// localStorage key
const SITE_SETTINGS_KEY = 'wagent_site_settings';

// Default settings
const defaultSettings = {
  // Logo settings
  logoType: 'text' as 'text' | 'image',
  logoText: 'WAgent',
  logoImageUrl: '',
  logoImageData: '', // Base64 for uploaded image
  
  // Site information
  siteName: 'WAgent',
  siteDescription: '智能代理平台 - 连接 AI 与工具，实现自动化工作流',
  faviconUrl: '',
  
  // SEO settings
  pageTitleTemplate: '{page} | {site}',
  metaDescription: 'WAgent - 一个强大的智能代理平台，支持多种 AI 模型和工具集成',
  metaKeywords: 'WAgent, AI, Agent, 智能代理, 自动化, LLM, Chatbot',
};

export interface SiteSettingsData {
  logoType: 'text' | 'image';
  logoText: string;
  logoImageUrl: string;
  logoImageData: string;
  siteName: string;
  siteDescription: string;
  faviconUrl: string;
  pageTitleTemplate: string;
  metaDescription: string;
  metaKeywords: string;
}

// Helper to get settings from localStorage
export function getSiteSettings(): SiteSettingsData {
  try {
    const stored = localStorage.getItem(SITE_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load site settings:', e);
  }
  return { ...defaultSettings };
}

// Helper to save settings to localStorage
export function saveSiteSettings(settings: Partial<SiteSettingsData>): void {
  try {
    const current = getSiteSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save site settings:', e);
  }
}

// Helper to apply settings to the page
export function applySiteSettings(settings: SiteSettingsData): void {
  // Update page title
  document.title = settings.siteName;
  
  // Update meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', settings.metaDescription);
  
  // Update meta keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.setAttribute('content', settings.metaKeywords);
  
  // Update favicon if provided
  if (settings.faviconUrl) {
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }
    favicon.setAttribute('href', settings.faviconUrl);
  }
}

export default function SiteSettings() {
  const [form] = Form.useForm();
  const [settings, setSettings] = useState<SiteSettingsData>(defaultSettings);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string>('');

  // Load settings on mount
  useEffect(() => {
    const loaded = getSiteSettings();
    setSettings(loaded);
    form.setFieldsValue(loaded);
    
    // Set preview image
    if (loaded.logoType === 'image') {
      const imageUrl = loaded.logoImageData || loaded.logoImageUrl;
      if (imageUrl) {
        setPreviewImage(imageUrl);
      }
    }
  }, [form]);

  const handleSave = (values: any) => {
    const newSettings: SiteSettingsData = {
      ...values,
      logoImageData: settings.logoImageData,
    };
    
    saveSiteSettings(newSettings);
    setSettings(newSettings);
    applySiteSettings(newSettings);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('site-settings-changed'));
    
    message.success('站点设置已保存');
  };

  const handleReset = () => {
    form.setFieldsValue(defaultSettings);
    setSettings(defaultSettings);
    setFileList([]);
    setPreviewImage('');
    saveSiteSettings(defaultSettings);
    applySiteSettings(defaultSettings);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('site-settings-changed'));
    
    message.success('已重置为默认设置');
  };

  const handleImageUpload = (file: File): boolean => {
    // Validate file type
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('请上传图片文件');
      return false;
    }
    
    // Validate file size (max 2MB)
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过 2MB');
      return false;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setSettings(prev => ({ ...prev, logoImageData: base64 }));
      setPreviewImage(base64);
      form.setFieldsValue({ logoImageUrl: file.name });
    };
    reader.readAsDataURL(file);
    
    return false; // Prevent auto upload
  };

  const logoType = Form.useWatch('logoType', form);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Title level={2}>
        <GlobalOutlined style={{ marginRight: 8 }} />
        站点设置
      </Title>
      <Text type="secondary">自定义您的 WAgent 实例的品牌和 SEO 配置</Text>
      
      <Divider />
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={settings}
      >
        {/* Logo Settings Card */}
        <Card 
          title={<><FileImageOutlined style={{ marginRight: 8 }} />站点 Logo</>}
          style={{ marginBottom: 24 }}
        >
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Form.Item name="logoType" label="Logo 类型">
                <Radio.Group>
                  <Radio.Button value="text">文本 Logo</Radio.Button>
                  <Radio.Button value="image">图片 Logo</Radio.Button>
                </Radio.Group>
              </Form.Item>

              {logoType === 'text' ? (
                <Form.Item 
                  name="logoText" 
                  label="Logo 文本"
                  rules={[{ required: true, message: '请输入 Logo 文本' }]}
                >
                  <Input placeholder="例如: WAgent" maxLength={20} showCount />
                </Form.Item>
              ) : (
                <>
                  <Form.Item label="Logo 图片">
                    <Upload
                      accept="image/*"
                      fileList={fileList}
                      beforeUpload={handleImageUpload}
                      onChange={({ fileList }) => setFileList(fileList)}
                      maxCount={1}
                    >
                      <Button icon={<UploadOutlined />}>选择图片</Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                      支持 JPG、PNG、SVG 格式，建议尺寸 32x32 或 64x64，最大 2MB
                    </Text>
                  </Form.Item>
                  <Form.Item name="logoImageUrl" label="或输入图片 URL">
                    <Input 
                      placeholder="https://example.com/logo.png"
                      onChange={(e) => {
                        const url = e.target.value;
                        setPreviewImage(url);
                        setSettings(prev => ({ ...prev, logoImageData: '' }));
                      }}
                    />
                  </Form.Item>
                </>
              )}
            </Col>
            <Col xs={24} md={8}>
              <div style={{ 
                background: '#001529', 
                padding: 24, 
                borderRadius: 8,
                textAlign: 'center',
                minHeight: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {logoType === 'image' && previewImage ? (
                  <Image 
                    src={previewImage} 
                    alt="Logo Preview" 
                    style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }}
                    preview={false}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                ) : (
                  <span style={{ 
                    fontSize: 18, 
                    fontWeight: 700,
                    color: '#fff',
                  }}>
                    {form.getFieldValue('logoText') || 'WAgent'}
                  </span>
                )}
              </div>
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                预览效果
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Site Information Card */}
        <Card 
          title={<><InfoCircleOutlined style={{ marginRight: 8 }} />站点信息</>}
          style={{ marginBottom: 24 }}
        >
          <Form.Item 
            name="siteName" 
            label="站点名称"
            rules={[{ required: true, message: '请输入站点名称' }]}
          >
            <Input placeholder="例如: WAgent" maxLength={50} showCount />
          </Form.Item>
          
          <Form.Item name="siteDescription" label="站点描述">
            <TextArea 
              placeholder="简短描述您的站点"
              rows={2}
              maxLength={200}
              showCount
            />
          </Form.Item>
          
          <Form.Item name="faviconUrl" label="Favicon URL">
            <Input placeholder="https://example.com/favicon.ico" />
          </Form.Item>
        </Card>

        {/* SEO Settings Card */}
        <Card 
          title={<><GlobalOutlined style={{ marginRight: 8 }} />SEO 设置</>}
          style={{ marginBottom: 24 }}
        >
          <Form.Item 
            name="pageTitleTemplate" 
            label="页面标题模板"
            extra="使用 {page} 表示页面名称，{site} 表示站点名称"
          >
            <Input placeholder="{page} | {site}" />
          </Form.Item>
          
          <Form.Item name="metaDescription" label="Meta 描述">
            <TextArea 
              placeholder="搜索引擎显示的站点描述"
              rows={3}
              maxLength={300}
              showCount
            />
          </Form.Item>
          
          <Form.Item name="metaKeywords" label="Meta 关键词">
            <Input placeholder="关键词1, 关键词2, 关键词3" />
          </Form.Item>
        </Card>

        {/* Action Buttons */}
        <Card>
          <Space size="middle">
            <Button 
              type="primary" 
              htmlType="submit" 
              icon={<SaveOutlined />}
              size="large"
            >
              保存设置
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleReset}
              size="large"
            >
              重置为默认
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
