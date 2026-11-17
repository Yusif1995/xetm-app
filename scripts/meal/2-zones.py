import json,re,collections,sys
T=r"C:\Users\User\AppData\Local\Temp\ayah"
ev=json.load(open(T+r"\events2.json"))
q=json.load(open("src/lib/quran-az.json"))
cnt=collections.Counter(x["c"] for x in q)
LT,LH,HW=.007,.06655,.026
def line(y): return int((y-LT)/LH)+1
seq=[(s,a) for s in range(2,115) for a in range(1,cnt[s]+1) if not (s==2 and a<=5)]
pages={}
i=0
for p in range(2,605):
    evs=ev[str(p)]
    out=[]; cur=(1,1.0)  # start: line 1, right edge
    pend_banner=None
    for e in evs:
        if e[0]=="b":
            pend_banner=e[1]; continue
        s,a=seq[i]; i+=1
        if a==1:
            if pend_banner is not None and line(pend_banner+LH*0.5)<=line(e[1]):
                last=line(pend_banner+LH*0.5)  # second line of the banner
                cur=(last+(1 if s==9 else 2),1.0)
            else:
                cur=(1 if s==9 else 2,1.0)  # banner sat at the foot of the previous page; basmala on line 1
            pend_banner=None
        L=line(e[1]); x=e[2]
        segs=[]
        L0,x0=cur
        if L0==L: segs.append([L,round(max(x-HW,0),3),round(x0,3)])
        else:
            if x0>0.02: segs.append([L0,0,round(x0,3)])
            for k in range(L0+1,L): segs.append([k,0,1])
            segs.append([L,round(max(x-HW,0),3),1])
        out.append([s,a,segs])
        nx=x-HW
        cur=(L,nx) if nx>0.03 else (L+1,1.0)
    pages[p]=out
assert i==len(seq), i
json.dump(pages,open(T+r"\zones.json","w"))
print("ok", sum(len(v) for v in pages.values()))
