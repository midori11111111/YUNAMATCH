self.addEventListener("push",event=>{
  let data={title:"YUNAMATCH",body:"新しい通知があります",url:"/"};
  try{data={...data,...event.data.json()}}catch(error){void error}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"/favicon.svg",badge:"/favicon.svg",tag:data.url,data:{url:data.url}}));
});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{const target=new URL(event.notification.data?.url||"/",self.location.origin).href;const existing=windows.find(client=>client.url===target);return existing?existing.focus():clients.openWindow(target)}))});
