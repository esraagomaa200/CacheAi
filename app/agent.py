"""
LAYER 3 — GENERATION (Agent)  +  LAYER 4 — SAFETY

الـ Agent:
1. يسترجع أفضل chunks (reranker).
2. Safety gate: لو الـ reranker score للأفضل نتيجة واطي جداً => يرفض الرد
   ("مش موجود في المصادر") بدل ما يخلي الـ LLM يهلوسن.
3. يبعت للـ LLM (Groq / Llama-3.3-70B) الـ chunks كـ context فقط،
   مع تعليمات صارمة: جاوب من المصادر بس، حط citation [source_file, p.X],
   ولو المعلومة مش موجودة قول كده صراحة.
4. يرجّع الإجابة + قائمة المصادر (evidence panel) منفصلة عن نص الـ LLM
   عشان الفرونت اند يعرضها بشكل موثوق مش معتمد على التزام الموديل بالفورمات.

المتطلب من الـ Terms (بند 4.1 و4.2): الرد لازم يكون مبني بس على
المصادر المعتمدة (WHO/NICE...) وممنوع أي هلوسة طبية.
"""
import os
from groq import Groq



GROQ_MODEL = "openai/gpt-oss-120b"
MIN_RERANK_SCORE = 0.5  # هتحتاج تظبطها بعد تجربة أسئلة حقيقية (شوف ملاحظة تحت)

SYSTEM_PROMPT = """أنت مساعد طبي داعم لاتخاذ القرار السريري (Clinical Decision Support).

استخدم فقط المعلومات الموجودة حرفيًا أو بشكل مباشر في CONTEXT المقدم لك.
ممنوع استخدام المعرفة الطبية الخارجية أو التخمين أو ملء الفراغات من معرفتك.

قواعد صارمة:

1. لا تجب إلا من المعلومات الموجودة في CONTEXT.
2. إذا كانت المعلومات غير كافية للإجابة، قل:
   "لا تحتوي المصادر المتاحة على إجابة كافية لهذا السؤال."
3. لا تخترع أي معلومة أو استنتاج طبي غير مدعوم مباشرة بالمصادر.
4. حافظ على أسماء الأدوية، الجرعات، الوحدات، الأوقات، النسب، الحدود الرقمية،
   وأسماء الإجراءات كما وردت في المصدر. لا تغيّرها أو تستبدلها بمرادفات
   إذا كان ذلك قد يغير المعنى.
5. ممنوع إضافة جرعة أو دواء أو تدخل علاجي أو contraindication غير موجود
   في CONTEXT.
6. كل ادعاء طبي مهم يجب أن يحتوي على citation:
   (المصدر: <source_file>, صفحة <page>)
7. إذا كانت معلومة مدعومة بأكثر من مصدر، اذكر المصادر ذات الصلة فقط.
8. لا تخلط توصيات من مصادر مختلفة وكأنها توصية واحدة، إلا إذا كان
   السياق نفسه يوضح أنها متوافقة.
9. إذا كان السؤال يطلب قرارًا علاجيًا لمريض حقيقي، وضّح أن النظام
   Prototype تعليمي وليس بديلاً عن تقييم الطبيب.
10. لا تقل إن المعلومة "مؤكدة" أو "صحيحة طبيًا" لمجرد أنها موجودة في المصدر.
11. لا تضف معلومات عامة في نهاية الإجابة لمجرد تقديم نصيحة إضافية.
12. إذا لم تجد المعلومة المطلوبة في CONTEXT، ارفض الإجابة الجزئية بدل
   تخمين الجزء الناقص.

أخرج الإجابة بلغة سؤال المستخدم، وبصياغة واضحة ومختصرة.

IMPORTANT MEDICAL TERMINOLOGY RULES:

- Do not translate drug names, drug classes, receptor names, gene/protein names,
  abbreviations, medical scores, or technical medical terms if translation could
  change their meaning.
- Preserve terms such as P2Y12, PCI, STEMI, FMC, ECG, NSAIDs exactly as written.
- Preserve drug names exactly as they appear in the source.
- Never invent an Arabic transliteration for a drug name.
- If you are uncertain about the Arabic rendering of a medical term, keep the
  original English term instead.
- Do not translate "P2Y12" as a general Arabic phrase.
If translating a medical term may introduce ambiguity or error, keep the
original English term in parentheses or use the original English term.

SOURCE FIDELITY RULES:

- Treat each retrieved source independently.
- Do not merge recommendations from different sources into a single
  recommendation unless the sources explicitly state the same recommendation.
- Do not create a new clinical protocol by combining separate passages.
- Preserve the original terminology, drug names, doses, units, timing,
  thresholds, and conditions from the source.
- Do not translate or reinterpret technical terms when doing so may change
  their meaning. Keep terms such as P2Y12, PCI, FMC, STEMI, ECG, Ticagrelor,
  and Clopidogrel in their original form when appropriate.
- Do not introduce information that is not explicitly supported by the
  retrieved context.
- If two retrieved sources give different recommendations, present them
  separately and identify the source for each one. Do not silently reconcile
  them.
- Do not add a "summary" that introduces, combines, or modifies medical
  recommendations. If a summary is useful, it must contain only information
  already stated above.
- When citing a claim, cite the exact source and page associated with that
  claim, rather than attaching one citation to a whole paragraph containing
  multiple claims.
  
Answer using only the retrieved evidence.
Prefer concise bullet points.
Do not repeat the same recommendation in a separate summary.
"""


class MedicalRAGAgent:
    def __init__(self, retriever, groq_api_key: str | None = None):
        self.retriever = retriever
        self.client = Groq(api_key=groq_api_key or os.environ["GROQ_API_KEY"])

    def _build_context(self, chunks):
        blocks = []
        for c in chunks:
            blocks.append(
                f"[{c['source_file']} | صفحة {c.get('page_start')}-{c.get('page_end')}]\n{c['text']}"
            )
        return "\n\n---\n\n".join(blocks)

    def answer(self, question: str, top_k: int = 5) -> dict:
        normalization = self.retriever.normalize_query(question)
        retrieval_query = normalization.get("retrieval_query", "").strip()

        # Gemini is only a query normalizer. It cannot expand the source scope
        # and it cannot write the medical answer.
        if not normalization.get("in_scope") or not retrieval_query:
            print("\n========== RAG DEBUG ==========")
            print("QUESTION:", question)
            print("OUT OF SCOPE: no supported topic anchor")
            print("================================\n")
            return {
                "answer": "هذا السؤال يبدو خارج نطاق المصادر الطبية المتاحة لدينا، "
                          "لذلك لا يمكنني تقديم إجابة موثوقة.",
                "sources": [],
                "grounded": False,
            }

        chunks = self.retriever.retrieve(retrieval_query, method="reranker", top_k=top_k)
        
        print("\n========== RAG DEBUG ==========")
        print("QUESTION:", question)
        print("NORMALIZED QUERY:", retrieval_query)
        print("TOPIC:", normalization.get("topic"))
        print("CHUNKS:", len(chunks))

        for i, c in enumerate(chunks, 1):
            print(
                f"{i}. rerank={c.get('rerank_score')} "
                f"source={c.get('source_file')} "
                f"pages={c.get('page_start')}-{c.get('page_end')}"
            )

        print("================================\n")

        # --- Safety gate: مفيش نتائج كفاية / relevance واطي ---
        if not chunks:
            return {
                "answer": "لا تحتوي المصادر المتاحة على إجابة كافية لهذا السؤال.",
                "sources": [],
                "grounded": False,
            }

        top_score = chunks[0].get("rerank_score", 0)
        if top_score < MIN_RERANK_SCORE:
            return {
                "answer": "هذا السؤال يبدو خارج نطاق المصادر الطبية المتاحة لدينا، "
                          "لذلك لا يمكنني تقديم إجابة موثوقة.",
                "sources": [],
                "grounded": False,
            }

        context = self._build_context(chunks)
        completion = self.client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.2,
            # Latency controls for the live demo: gpt-oss reasoning defaults
            # to medium effort and unbounded length — both cost seconds.
            # Grounding quality comes from the retrieved CONTEXT, not from
            # long deliberation.
            reasoning_effort="low",
            max_completion_tokens=900,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"CONTEXT:\n{context}\n\nسؤال المستخدم: {question}"},
            ],
        )
        answer_text = completion.choices[0].message.content

        sources = [
            {
                "source_file": c["source_file"],
                "page_start": c.get("page_start"),
                "page_end": c.get("page_end"),
                "section": c.get("section"),
                "score": c.get("rerank_score"),
            }
            for c in chunks
        ]
        return {"answer": answer_text, "sources": sources, "grounded": True}
