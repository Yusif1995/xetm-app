import sys, json, numpy as np, cv2
from PIL import Image
D=sys.argv[1]
def blobs(path):
    a=np.asarray(Image.open(path).convert("RGB")).astype(int)
    R,G,B=a[...,0],a[...,1],a[...,2]
    m=((R>95)&(R<175)&(R-B>22)&(G<R)).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
    n,lab,st,cen=cv2.connectedComponentsWithStats(m)
    H,W=a.shape[:2]
    comps=[[int(st[i][0]),int(st[i][1]),int(st[i][0]+st[i][2]),int(st[i][1]+st[i][3]),int(st[i][4])] for i in range(1,n)]
    big=[c for c in comps if c[4]>400]; small=[c for c in comps if 200<c[4]<=400 or (400<c[4]<600 and (c[2]-c[0])<32)]
    # merge halves of a marker split by its digits
    merged=[];used=set()
    for i,c in enumerate(big):
        if i in used: continue
        cur=list(c)
        for j,d in enumerate(big):
            if j<=i or j in used: continue
            if abs((c[0]+c[2])/2-(d[0]+d[2])/2)<14 and (max(cur[1],d[1])-min(cur[3],d[3]))<16:
                cur=[min(cur[0],d[0]),min(cur[1],d[1]),max(cur[2],d[2]),max(cur[3],d[3]),cur[4]+d[4]];used.add(j)
        merged.append(cur)
    mk=[]
    for c in merged:
        w=c[2]-c[0];h=c[3]-c[1]
        if c[4]>900 and 0.6<w/h<1.6 and w<90: mk.append(((c[0]+c[2])/2/W,(c[1]+c[3])/2/H))
    sm=[((c[0]+c[2])/2/W,(c[1]+c[3])/2/H) for c in comps if 200<c[4]<600 and (c[2]-c[0])<32]
    ban=[]
    for (x1,y1) in sm:
        if abs(x1-.154)<.02 and any(abs(x2-.842)<.02 and abs(y2-y1)<.01 for (x2,y2) in sm): ban.append(y1)
    ban=sorted(ban); bb=[]
    for y in ban:
        if not bb or y-bb[-1]>0.09: bb.append(y)
    return mk,bb
pages=["1","1b"]+[str(i) for i in range(2,605)]
out={}
LH=.06655
for p in pages:
    mk,ban=blobs(f"public/mushaf/{p}.webp")
    ev=[("b",y,0) for y in ban]+[("m",y,x) for x,y in mk]
    ev.sort(key=lambda e:((e[1]-.007)/LH-0.5 if e[0]=="b" else round((e[1]-.007)/LH-0.5), -e[2]))
    out[p]=[[e[0],round(e[1],4),round(e[2],4)] for e in ev]
json.dump(out,open(D+"/events2.json","w"))
print(sum(1 for v in out.values() for e in v if e[0]=="m"))
