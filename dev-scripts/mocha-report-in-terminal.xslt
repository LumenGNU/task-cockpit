<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text" encoding="UTF-8"/>


  <!-- Имя фикстуры, передаётся через xsltproc - -stringparam TITLE "..." -->
  <xsl:param name="TITLE"/>

  <xsl:template match="/testsuite">

    <xsl:variable name="failed" select="@errors + @failures"/>

    <!-- Заголовок -->

    <xsl:text><![CDATA[\e[1m]]></xsl:text>

    <!-- Mocha хардкодит failures=0 и кладёт всё в errors,
         поэтому суммируем оба атрибута для совместимости -->

    <!-- Красный цвет заголовка если есть фейлы -->
    <xsl:if test="$failed &gt; 0">
      <xsl:text><![CDATA[\e[31m]]></xsl:text>
    </xsl:if>

    <xsl:choose>
      <xsl:when test="string-length($TITLE) &gt; 0">
        <xsl:value-of select="$TITLE"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="@timestamp"/>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text> (</xsl:text>
    <xsl:value-of select="@tests"/>
    <xsl:text> tests, </xsl:text>
    <xsl:value-of select="$failed"/>
    <xsl:text> failed, </xsl:text>
    <xsl:value-of select="@skipped"/>
    <xsl:text> skipped) </xsl:text>
    <xsl:value-of select="format-number(@time, '0.000')"/>
    <xsl:text>s</xsl:text>

    <!-- Сброс цвета заголовка -->
    <xsl:text><![CDATA[\e[0m]]></xsl:text>

    <xsl:text>&#10;</xsl:text>

    <!-- Список тестов -->
    <!-- Статус определяется по дочернему элементу testcase:
         <failure> = упал, <skipped/> = пропущен, иначе = прошёл.
         Красным подсвечиваем только упавшие — остальные не отвлекают -->
    <xsl:for-each select="testcase">
      <xsl:text>&#10;  </xsl:text> <!-- новая строка перед каждым test() -->
      <xsl:choose>
        <xsl:when test="failure">
          <xsl:text><![CDATA[\e[31m✗]]></xsl:text>
        </xsl:when>
        <xsl:when test="skipped">○</xsl:when>
        <xsl:otherwise>✓</xsl:otherwise>
      </xsl:choose>
      <xsl:text> </xsl:text>
      <!-- classname = конкатенация describe() через пробел, name = текст it() -->
      <xsl:value-of select="@classname"/>
      <xsl:text>&#10;    › </xsl:text>
      <xsl:value-of select="@name"/>
      <xsl:if test="failure">
        <xsl:text><![CDATA[\e[0m]]></xsl:text>
      </xsl:if>
      <xsl:text>&#10;</xsl:text>

      <!-- Тело ошибки: message + diff + stack из <failure> -->
      <xsl:if test="failure">
        <xsl:call-template name="indent-lines">
          <xsl:with-param name="text" select="failure"/>
        </xsl:call-template>
      </xsl:if>
    </xsl:for-each>

    <xsl:text>&#10;&#10;</xsl:text>

  </xsl:template>

  <!-- Вывод многострочного текста с отступом и подсветкой дифов -->
  <!-- Каждая строка:
       1. Убираем ведущие табы (Mocha добавляет их в xunit output)
       2. Проверяем первый символ: + → красный, - → синий (diff)
       3. Добавляем 8-пробельный отступ -->
  <xsl:template name="indent-lines">
    <xsl:param name="text"/>
    <xsl:param name="pad" select="'        '"/>
    <xsl:choose>
      <!-- Есть ещё строки -->
      <xsl:when test="contains($text, '&#10;')">
        <xsl:variable name="clean">
          <xsl:call-template name="strip-leading-tabs">
            <xsl:with-param name="text" select="substring-before($text, '&#10;')"/>
          </xsl:call-template>
        </xsl:variable>

        <xsl:value-of select="$pad"/>

        <xsl:variable name="color">
          <xsl:choose>
            <xsl:when test="starts-with($clean, '+')"><![CDATA[\e[31m]]></xsl:when>
            <xsl:when test="starts-with($clean, '-')"><![CDATA[\e[34m]]></xsl:when>
            <xsl:when test="starts-with($clean, ' ') and starts-with(normalize-space($clean), '+')"><![CDATA[\e[34m]]></xsl:when>
            <xsl:when test="starts-with($clean, ' ') and starts-with(normalize-space($clean), '-')"><![CDATA[\e[31m]]></xsl:when>
          </xsl:choose>
        </xsl:variable>

        <xsl:value-of select="$color"/>
        <xsl:value-of select="$clean"/>
        <xsl:if test="string-length($color) &gt; 0"><![CDATA[\e[0m]]></xsl:if>
        <xsl:text>&#10;</xsl:text>

        <xsl:call-template name="indent-lines">
          <xsl:with-param name="text" select="substring-after($text, '&#10;')"/>
          <xsl:with-param name="pad" select="$pad"/>
        </xsl:call-template>
      </xsl:when>
      <!-- Последняя строка (без завершающего \n) -->
      <xsl:when test="string-length($text) &gt; 0">
        <xsl:variable name="clean">
          <xsl:call-template name="strip-leading-tabs">
            <xsl:with-param name="text" select="$text"/>
          </xsl:call-template>
        </xsl:variable>

        <xsl:value-of select="$pad"/>

        <xsl:variable name="color">
          <xsl:choose>
            <xsl:when test="starts-with($clean, '+')"><![CDATA[\e[31m]]></xsl:when>
            <xsl:when test="starts-with($clean, '-')"><![CDATA[\e[34m]]></xsl:when>
            <xsl:when test="starts-with($clean, ' ') and starts-with(normalize-space($clean), '+')"><![CDATA[\e[34m]]></xsl:when>
            <xsl:when test="starts-with($clean, ' ') and starts-with(normalize-space($clean), '-')"><![CDATA[\e[31m]]></xsl:when>
          </xsl:choose>
        </xsl:variable>

        <xsl:value-of select="$color"/>
        <xsl:value-of select="$clean"/>
        <xsl:if test="string-length($color) &gt; 0"><![CDATA[\e[0m]]></xsl:if>
        <xsl:text>&#10;</xsl:text>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

  <!-- Удаление ведущих табов -->
  <xsl:template name="strip-leading-tabs">
    <xsl:param name="text"/>
    <xsl:choose>
      <xsl:when test="starts-with($text, '&#9;')">
        <xsl:call-template name="strip-leading-tabs">
          <xsl:with-param name="text" select="substring($text, 2)"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$text"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>